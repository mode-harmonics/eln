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

@ApiTags('Reagent Procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ReagentProcurementController {
  constructor(
    private readonly procurementService: ReagentProcurementService,
  ) {}

  @Get('projects/:projectId/procurement')
  @RequirePermission('procurement:read')
  async list(@Param('projectId') projectId: string) {
    return {
      success: true,
      data: await this.procurementService.findByProject(projectId),
    };
  }

  @Put('projects/:projectId/procurement/:id')
  @RequirePermission('procurement:write')
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
