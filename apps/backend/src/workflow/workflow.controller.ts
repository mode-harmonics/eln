import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkflowService } from './workflow.service';
import {
  CreateWorkflowInstanceDto,
  CreateWorkflowTemplateDto,
  UpdateStepAssignmentDto,
  UpdateWorkflowTemplateDto,
} from './dto/workflow.dto';

@ApiTags('Workflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // ─── Templates ────────────────────────────────────────────────

  @Get('workflow/templates')
  @RequirePermission('workflow:read')
  @ApiOperation({ summary: 'List workflow templates, optionally filter by isDefault' })
  async listTemplates(@Query('isDefault') isDefault?: string) {
    const filter = isDefault !== undefined ? isDefault === 'true' : undefined;
    return { success: true, data: await this.workflowService.findTemplates(filter) };
  }

  @Get('workflow/templates/:id')
  @RequirePermission('workflow:read')
  @ApiOperation({ summary: 'Get a single workflow template' })
  async getTemplate(@Param('id') id: string) {
    return { success: true, data: await this.workflowService.findTemplateById(id) };
  }

  @Post('workflow/templates')
  @RequirePermission('workflow:write')
  @ApiOperation({ summary: 'Create a new workflow template' })
  async createTemplate(@Body() dto: CreateWorkflowTemplateDto) {
    return { success: true, data: await this.workflowService.createTemplate(dto) };
  }

  @Put('workflow/templates/:id')
  @RequirePermission('workflow:write')
  @ApiOperation({ summary: 'Update a workflow template' })
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateWorkflowTemplateDto) {
    return { success: true, data: await this.workflowService.updateTemplate(id, dto) };
  }

  @Delete('workflow/templates/:id')
  @RequirePermission('workflow:write')
  @ApiOperation({ summary: 'Delete a workflow template (cannot delete default)' })
  async deleteTemplate(@Param('id') id: string) {
    await this.workflowService.removeTemplate(id);
    return { success: true, data: null };
  }

  // ─── Instances ────────────────────────────────────────────────

  @Post('workflow/instances')
  @RequirePermission('workflow:write')
  @ApiOperation({ summary: 'Create a workflow instance for a project' })
  async createInstance(@Body() dto: CreateWorkflowInstanceDto) {
    return { success: true, data: await this.workflowService.createInstance(dto) };
  }

  @Get('workflow/instances/:projectId')
  @RequirePermission('projects:read')
  @ApiOperation({ summary: 'Get workflow instance + steps visible to current user for a project' })
  async getInstance(@Param('projectId') projectId: string, @CurrentUser('id') userId: string) {
    return { success: true, data: await this.workflowService.findByProject(projectId, userId) };
  }

  @Get('workflow/instances/:projectId/steps')
  @RequirePermission('projects:read')
  @ApiOperation({ summary: 'Get all step assignments for a project' })
  async getSteps(@Param('projectId') projectId: string) {
    return { success: true, data: await this.workflowService.getSteps(projectId) };
  }

  @Put('workflow/instances/:projectId/transition')
  @RequirePermission('workflow:transition')
  @ApiOperation({
    summary: 'Complete current step and advance workflow to next step(s)',
    description: 'The current user must be assigned to the current step. For parallel groups, all children must complete before advancing past the group.',
  })
  async transition(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return {
      success: true,
      data: await this.workflowService.transition(projectId, userId),
    };
  }

  @Put('workflow/instances/:projectId/steps/:stepName')
  @RequirePermission('workflow:write')
  @ApiOperation({ summary: 'Update step assignment (reassign user, change permissions)' })
  async updateStepAssignment(
    @Param('projectId') projectId: string,
    @Param('stepName') stepName: string,
    @Body() dto: UpdateStepAssignmentDto,
  ) {
    return {
      success: true,
      data: await this.workflowService.updateStepAssignment(projectId, stepName, dto),
    };
  }

  // ─── Permissions ─────────────────────────────────────────────

  @Get('workflow/instances/:projectId/permissions')
  @ApiOperation({ summary: 'Get current user permissions for this project workflow' })
  async getPermissions(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return {
      success: true,
      data: await this.workflowService.getUserProjectPermissions(projectId, userId),
    };
  }

  // ─── My Tasks ─────────────────────────────────────────────────

  @Get('workflow/tasks')
  @ApiOperation({ summary: 'Get all active workflow tasks for current user across projects' })
  async getMyTasks(@CurrentUser('id') userId: string) {
    return { success: true, data: await this.workflowService.getMyTasks(userId) };
  }
}
