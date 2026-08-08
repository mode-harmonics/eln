import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Readable } from 'stream';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, hasPermission } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { DataService } from './data.service';
import { WorkflowService } from '../workflow/workflow.service';
import { RECORD_TYPE_TO_API_TYPE as RECORD_TYPE_TO_PERMISSION } from '@eln/shared';
import { UploadDataDto } from './dto/upload-data.dto';
import { PickCellsDto } from '../experiments/dto/pick-cells.dto';

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('data')
export class DataController {
  constructor(
    private readonly dataService: DataService,
    private readonly workflowService: WorkflowService,
  ) {}

  @Post('upload')
  @RequirePermission('experiments:write')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload multiple multi-sheet Excel workbooks; parses and inserts into the 7 battery-data tables.',
  })
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 50 * 1024 * 1024 } }))
  async upload(
    @UploadedFiles() files: UploadedFile[],
    @Body() dto: UploadDataDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded. Expected multipart field "files".');
    }

    const experiment = await this.dataService.getExperiment(dto.experimentId);
    if (!experiment) {
      throw new BadRequestException('Experiment not found.');
    }

    const workbooks = files.map(f => ({
      buffer: f.buffer,
      originalname: f.originalname,
      mimetype: f.mimetype,
    }));
    return this.dataService.uploadWorkbooks(workbooks, dto.experimentId, user.id, dto.mode);
  }

  @Post('upload-project/:projectId')
  @RequirePermission('experiments:write')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Import summary workbook(s) to a project. Routes each data sheet (by sheet name) to the matching experiment, then completes the workflow.',
  })
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadToProject(
    @UploadedFiles() files: UploadedFile[],
    @Param('projectId') projectId: string,
    @Body() dto: { mode?: 'overwrite' | 'merge' },
    @CurrentUser() user: RequestUser,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded. Expected multipart field "files".');
    }

    const workbooks = files.map(f => ({
      buffer: f.buffer,
      originalname: f.originalname,
      mimetype: f.mimetype,
    }));

    const result = await this.dataService.importSummaryWorkbook(
      workbooks,
      projectId,
      user.id,
      dto.mode ?? 'merge',
    );

    if (result.sheetsProcessed === 0) {
      throw new BadRequestException(
        'No data sheets found. Expected sheets named like 数据记录-制程数据 / 数据记录-日历寿命 / 数据记录-4C DCR, etc.',
      );
    }

    // Summary data import is the final project-level step — complete the workflow
    let workflowCompleted = false;
    try {
      const wf = await this.workflowService.completeWorkflow(projectId, user.id);
      workflowCompleted = wf.completed;
    } catch (err: any) {
      console.warn(`Workflow completion after summary import failed: ${err?.message}`);
    }

    return { ...result, workflowCompleted };
  }

  @Get('export/summary/:expId')
  @RequirePermission('experiments:read')
  @ApiOperation({ summary: 'Export summary data for an experiment.' })
  async exportSummary(@Param('expId') expId: string) {
    const buffer = await this.dataService.exportSummaryBuffer(expId);
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return new StreamableFile(stream, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="summary.xlsx"',
    });
  }

  @Get('export/raw/:expId')
  @RequirePermission('experiments:read')
  @ApiOperation({ summary: 'Export raw data for an experiment.' })
  async exportRaw(@Param('expId') expId: string) {
    const buffer = await this.dataService.exportRawBuffer(expId);
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return new StreamableFile(stream, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="raw.xlsx"',
    });
  }

  @Get('export/project/:projectId')
  @RequirePermission('experiments:read')
  @ApiOperation({ summary: 'Export ALL business data for a project as an Excel workbook with Chinese headers.' })
  async exportProjectData(@Param('projectId') projectId: string) {
    const buffer = await this.dataService.exportProjectBuffer(projectId);
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return new StreamableFile(stream, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="project-data.xlsx"',
    });
  }

  @Get('raw/:expId')
  @RequirePermission('experiments:read')
  @ApiOperation({ summary: 'Query raw step data rows for an experiment. Optional ?source=formation|grading to filter by data source.' })
  async findRawSteps(
    @Param('expId') expId: string,
    @Query('source') source?: string,
  ) {
    return this.dataService.findRawSteps(expId, source);
  }

  @Post('pick-cells/:projectId')
  @RequirePermission('experiments:write')
  @ApiOperation({ summary: 'Auto or manual pick cells for a project (project-scoped).' })
  async pickCells(
    @Param('projectId') projectId: string,
    @Body() dto: PickCellsDto,
    @CurrentUser() _user: RequestUser,
  ) {
    if (dto.mode === 'manual') {
      return this.dataService.manualPickCells(projectId, dto.assignments, dto.cellIds);
    }
    return this.dataService.autoPickCells(projectId);
  }

  @Get('picked-cells/:projectId')
  @RequirePermission('experiments:read')
  @ApiOperation({ summary: 'Get picked cells for a project.' })
  async getPickedCells(@Param('projectId') projectId: string) {
    return this.dataService.getPickedCells(projectId);
  }

  @Get('scrapped-cells/:projectId')
  @RequirePermission('experiments:read')
  @ApiOperation({ summary: 'Get scrapped cells for a project.' })
  async getScrappedCells(@Param('projectId') projectId: string) {
    return this.dataService.getScrappedCells(projectId);
  }

  @Post('scrapped-cells/:projectId')
  @RequirePermission('experiments:write')
  @ApiOperation({ summary: 'Scrap a single battery (project-scoped).' })
  async scrapCell(
    @Param('projectId') projectId: string,
    @Body() body: { cellId: string; reason?: string },
    @CurrentUser() user: RequestUser,
  ) {
    if (!body?.cellId) {
      throw new BadRequestException('cellId is required.');
    }
    return this.dataService.scrapCell(projectId, body.cellId, user.id, body.reason);
  }

  @Post('scrapped-cells/:projectId/restore')
  @RequirePermission('experiments:write')
  @ApiOperation({ summary: 'Restore a scrapped battery (remove the scrap record).' })
  async restoreCell(
    @Param('projectId') projectId: string,
    @Body() body: { cellId: string },
  ) {
    if (!body?.cellId) {
      throw new BadRequestException('cellId is required.');
    }
    return this.dataService.restoreCell(projectId, body.cellId);
  }

  @Post('sync-cells/:projectId')
  @RequirePermission('experiments:write')
  @ApiOperation({ summary: 'Sync picked cells to all 6 target business tables (project-scoped, destructive).' })
  async syncCells(
    @Param('projectId') projectId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.dataService.syncCellsToTables(projectId, user.id);
  }

  @Get(':type/:expId')
  @RequirePermission('experiments:read')
  @ApiOperation({
    summary: 'Query rows for a business table by type (process/calendar/swelling/efficiency/dcr/fastcharge/htcycle) and experiment.',
  })
  async findByType(
    @Param('type') type: string,
    @Param('expId') expId: string,
  ) {
    return this.dataService.findByType(type, expId);
  }

  @Post(':type/:expId')
  @RequirePermission('experiments:write')
  @ApiOperation({
    summary: 'Create a new row in a business table (for manual entry, e.g. StorageSwelling).',
  })
  async createRow(
    @Param('type') type: string,
    @Param('expId') expId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dataService.createRow(type, expId, body);
  }

  /** Batch update rows of a business table — single PUT /api/v1/data/:type/batch */
  @Put(':type/batch')
  @RequirePermission('experiments:write')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Batch update rows of a business table. Accepts { rows: [{ id, ...fields }] }.',
  })
  async batchUpdate(
    @Param('type') type: string,
    @Body() body: { rows: Record<string, unknown>[] },
  ) {
    const count = await this.dataService.batchUpdateRows(type, body.rows);
    return { success: true, data: { updated: count } };
  }

  @Put(':type/:id')
  @RequirePermission('experiments:write')
  @ApiOperation({
    summary: 'Update a single data row by type and row ID.',
  })
  async updateRow(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dataService.updateRow(type, id, body);
  }

  @Delete(':type/:id')
  @RequirePermission('experiments:write')
  @ApiOperation({
    summary: 'Delete a single data row by type and row ID.',
  })
  async deleteRow(
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.dataService.deleteRow(type, id);
  }
}