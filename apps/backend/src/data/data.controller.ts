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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Res,
} from '@nestjs/common';
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
  async exportSummary(@Param('expId') expId: string, @Res() res: any) {
    const workbook = await this.dataService.exportSummaryData(expId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'summary.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  }

  @Get('export/raw/:expId')
  @ApiOperation({ summary: 'Export raw data for an experiment.' })
  async exportRaw(@Param('expId') expId: string, @Res() res: any) {
    const workbook = await this.dataService.exportRawData(expId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'raw.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  }

  @Get('raw/:expId')
  @ApiOperation({ summary: 'Query raw step data rows for an experiment.' })
  async findRawSteps(@Param('expId') expId: string) {
    return this.dataService.findRawSteps(expId);
  }

  @Post('pick-cells/:expId')
  @ApiOperation({ summary: 'Auto or manual pick cells for an experiment.' })
  async pickCells(
    @Param('expId') expId: string,
    @Body() dto: PickCellsDto,
    @Query('projectId') projectId: string,
  ) {
    const topN = dto.mode === 'auto' ? undefined : undefined;
    return this.dataService.autoPickCells(expId, projectId, topN);
  }

  @Get('picked-cells/:expId')
  @ApiOperation({ summary: 'Get picked cells for an experiment.' })
  async getPickedCells(@Param('expId') expId: string) {
    return this.dataService.getPickedCells(expId);
  }

  @Post('sync-cells/:expId')
  @ApiOperation({ summary: 'Sync picked cells to 5 target business tables.' })
  async syncCells(@Param('expId') expId: string) {
    return this.dataService.syncCellsToTables(expId);
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