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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, hasPermission } from '../common/guards/permissions.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { DataService } from './data.service';
import { UploadDataDto } from './dto/upload-data.dto';

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
    summary: 'Upload a multi-sheet Excel workbook; parses and inserts into the 7 battery-data tables.',
  })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDataDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Expected multipart field "file".');
    }

    const experiment = await this.dataService.getExperiment(dto.experimentId);
    if (!experiment) {
      throw new BadRequestException('Experiment not found.');
    }
    const assayType = (experiment.metadata?.assayType || experiment.metadata?.recordType) as string;
    const typeKey = RECORD_TYPE_TO_PERMISSION[assayType];
    const requiredPermission = typeKey ? `data_${typeKey}:write` : 'data:write';

    const hasSpecific = hasPermission(user.permissionList, requiredPermission);
    const hasGeneral = hasPermission(user.permissionList, 'data:write');
    if (!hasSpecific && !hasGeneral) {
      throw new ForbiddenException(
        `You do not have the required permission: ${requiredPermission} or data:write`,
      );
    }

    return this.dataService.uploadWorkbook(file.buffer, dto.experimentId);
  }

  @Get(':type/:expId')
  @ApiOperation({
    summary: 'Query rows for a business table by type (process/calendar/swelling/efficiency/dcr/fastcharge/htcycle) and experiment.',
  })
  async findByType(
    @Param('type') type: string,
    @Param('expId') expId: string,
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