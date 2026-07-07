import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { Readable } from 'stream';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, hasPermission } from '../common/guards/permissions.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { DataService } from './data.service';
import { UploadDataDto } from './dto/upload-data.dto';
import { PickCellsDto } from '../experiments/dto/pick-cells.dto';

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const RECORD_TYPE_TO_PERMISSION: Record<string, string> = {
  ProcessData: 'process',
  CalendarLife: 'calendar',
  StorageSwelling: 'swelling',
  EnergyEfficiency: 'efficiency',
  DcrTest: 'dcr',
  FastCharge: 'fastcharge',
  HtCycle: 'htcycle',
};

@ApiTags('data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('data')
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Post('upload')
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
    const assayType = experiment.metadata?.assayType as string;
    const typeKey = RECORD_TYPE_TO_PERMISSION[assayType];
    const requiredPermission = typeKey ? `data_${typeKey}:write` : 'data:write';

    const hasSpecific = hasPermission(user.permissionList, requiredPermission);
    const hasGeneral = hasPermission(user.permissionList, 'data:write');
    if (!hasSpecific && !hasGeneral) {
      throw new ForbiddenException(
        `You do not have the required permission: ${requiredPermission} or data:write`,
      );
    }

    const workbooks = files.map(f => ({
      buffer: f.buffer,
      originalname: f.originalname,
      mimetype: f.mimetype,
    }));
    return this.dataService.uploadWorkbooks(workbooks, dto.experimentId, user.id, dto.mode);
  }

  @Get('export/summary/:expId')
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

  @Get('raw/:expId')
  @ApiOperation({ summary: 'Query raw step data rows for an experiment. Optional ?source=formation|grading to filter by data source.' })
  async findRawSteps(
    @Param('expId') expId: string,
    @Query('source') source?: string,
  ) {
    return this.dataService.findRawSteps(expId, source);
  }

  @Post('pick-cells/:projectId')
  @ApiOperation({ summary: 'Auto or manual pick cells for a project (project-scoped).' })
  async pickCells(
    @Param('projectId') projectId: string,
    @Body() dto: PickCellsDto,
    @CurrentUser() _user: RequestUser,
  ) {
    if (dto.mode === 'manual') {
      return this.dataService.manualPickCells(projectId, dto.cellIds ?? []);
    }
    const topN = dto.topN != null && dto.topN > 0 ? dto.topN : undefined;
    return this.dataService.autoPickCells(projectId, topN);
  }

  @Get('picked-cells/:projectId')
  @ApiOperation({ summary: 'Get picked cells for a project.' })
  async getPickedCells(@Param('projectId') projectId: string) {
    return this.dataService.getPickedCells(projectId);
  }

  @Post('sync-cells/:projectId')
  @ApiOperation({ summary: 'Sync picked cells to all 6 target business tables (project-scoped, destructive).' })
  async syncCells(
    @Param('projectId') projectId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.dataService.syncCellsToTables(projectId, user.id);
  }

  @Get(':type/:expId')
  @ApiOperation({
    summary: 'Query rows for a business table by type (process/calendar/swelling/efficiency/dcr/fastcharge/htcycle) and experiment.',
  })
  async findByType(
    @Param('type') type: string,
    @Param('expId') expId: string,
    @Query('withGroups') withGroups: string | undefined,
    @Query('projectId') projectId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    const requiredPermission = `data_${type}:read`;
    const hasSpecific = hasPermission(user.permissionList, requiredPermission);
    const hasGeneral = hasPermission(user.permissionList, 'data:read');
    if (!hasSpecific && !hasGeneral) {
      throw new ForbiddenException(
        `You do not have the required permission: ${requiredPermission} or data:read`,
      );
    }
    if (withGroups === 'true' && projectId) {
      return this.dataService.findByTypeWithGroups(type, expId, projectId);
    }
    return this.dataService.findByType(type, expId);
  }

  @Post(':type/:expId')
  @ApiOperation({
    summary: 'Create a new row in a business table (for manual entry, e.g. StorageSwelling).',
  })
  async createRow(
    @Param('type') type: string,
    @Param('expId') expId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: RequestUser,
  ) {
    const requiredPermission = `data_${type}:write`;
    const hasSpecific = hasPermission(user.permissionList, requiredPermission);
    const hasGeneral = hasPermission(user.permissionList, 'data:write');
    if (!hasSpecific && !hasGeneral) {
      throw new ForbiddenException(
        `You do not have the required permission: ${requiredPermission} or data:write`,
      );
    }
    return this.dataService.createRow(type, expId, body);
  }

  @Put(':type/:id')
  @ApiOperation({
    summary: 'Update a single data row by type and row ID.',
  })
  async updateRow(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: RequestUser,
  ) {
    const requiredPermission = `data_${type}:write`;
    const hasSpecific = hasPermission(user.permissionList, requiredPermission);
    const hasGeneral = hasPermission(user.permissionList, 'data:write');
    if (!hasSpecific && !hasGeneral) {
      throw new ForbiddenException(
        `You do not have the required permission: ${requiredPermission} or data:write`,
      );
    }
    return this.dataService.updateRow(type, id, body);
  }

  @Delete(':type/:id')
  @ApiOperation({
    summary: 'Delete a single data row by type and row ID.',
  })
  async deleteRow(
    @Param('type') type: string,
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const requiredPermission = `data_${type}:write`;
    const hasSpecific = hasPermission(user.permissionList, requiredPermission);
    const hasGeneral = hasPermission(user.permissionList, 'data:write');
    if (!hasSpecific && !hasGeneral) {
      throw new ForbiddenException(
        `You do not have the required permission: ${requiredPermission} or data:write`,
      );
    }
    return this.dataService.deleteRow(type, id);
  }
}