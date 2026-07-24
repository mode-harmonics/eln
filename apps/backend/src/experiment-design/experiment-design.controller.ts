import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ExperimentDesignService } from './experiment-design.service';
import { BatchCreateDesignDto, UpdateExperimentDesignDto } from './dto/experiment-design.dto';

@ApiTags('Experiment Design')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ExperimentDesignController {
  constructor(
    private readonly designService: ExperimentDesignService,
  ) {}

  @Get('projects/:projectId/design')
  @RequirePermission('experiment_design:read')
  async list(@Param('projectId') projectId: string) {
    return {
      success: true,
      data: await this.designService.findByProject(projectId),
    };
  }

  @Post('projects/:projectId/design')
  @RequirePermission('experiment_design:write')
  async batchCreate(
    @Param('projectId') projectId: string,
    @Body() dto: BatchCreateDesignDto,
  ) {
    return {
      success: true,
      data: await this.designService.batchCreate(projectId, dto),
    };
  }

  @Put('projects/:projectId/design/:id')
  @RequirePermission('experiment_design:write')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExperimentDesignDto,
  ) {
    return {
      success: true,
      data: await this.designService.update(projectId, id, dto),
    };
  }

  @Delete('projects/:projectId/design/:id')
  @RequirePermission('experiment_design:write')
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    await this.designService.remove(projectId, id);
    return { success: true, data: null };
  }
}
