import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ReagentProcurementService } from './reagent-procurement.service';
import { UpdateProcurementDto } from './dto/update-procurement.dto';
import { BatchUpdateProcurementDto } from './dto/batch-update-procurement.dto';

@ApiTags('Reagent Procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ReagentProcurementController {
  constructor(
    private readonly procurementService: ReagentProcurementService,
  ) {}

  @Get('projects/:projectId/procurement')
  @RequirePermission('experiments:read')
  async list(@Param('projectId') projectId: string) {
    return {
      success: true,
      data: await this.procurementService.findByProject(projectId),
    };
  }

  @Get('projects/:projectId/procurement/valid-groups')
  @RequirePermission('experiments:read')
  async validGroups(@Param('projectId') projectId: string) {
    return {
      success: true,
      data: await this.procurementService.findValidGroupNames(projectId),
    };
  }

  @Get('projects/:projectId/procurement/invalid-internalcodes')
  @RequirePermission('experiments:read')
  async invalidInternalCodes(@Param('projectId') projectId: string) {
    return {
      success: true,
      data: await this.procurementService.findInvalidInternalCodes(projectId),
    };
  }

  @Put('projects/:projectId/procurement/batch')
  @RequirePermission('experiments:write')
  async updateBatch(
    @Param('projectId') projectId: string,
    @Body() dto: BatchUpdateProcurementDto,
  ) {
    return {
      success: true,
      data: await this.procurementService.updateBatch(projectId, dto.items),
    };
  }

  @Put('projects/:projectId/procurement/:id')
  @RequirePermission('experiments:write')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProcurementDto,
  ) {
    return {
      success: true,
      data: await this.procurementService.update(projectId, id, dto),
    };
  }
}
