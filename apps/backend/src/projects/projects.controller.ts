import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { CreateProjectDto, UpdateProjectDto, UpdateProjectMembersDto } from './dto';
import { CreateExperimentDto } from '../experiments/dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @RequirePermission('projects:read')
  @ApiOperation({ summary: "List projects visible to the current user's membership/ownership." })
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page as any, 10) : undefined;
    const limitNum = limit ? parseInt(limit as any, 10) : undefined;
    return this.projectsService.findVisibleToUser(user.id, pageNum, limitNum, search);
  }

  @Get(':id')
  @RequirePermission('projects:read')
  @ApiOperation({ summary: 'Get a single project by ID.' })
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.projectsService.findOne(id, user.id);
  }

  @Get(':id/experiments')
  @RequirePermission('projects:read')
  @ApiOperation({ summary: 'List all experiments belonging to this project.' })
  async findExperiments(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page as any, 10) : undefined;
    const limitNum = limit ? parseInt(limit as any, 10) : undefined;
    return this.projectsService.findExperiments(id, pageNum, limitNum, search);
  }

  @Get(':id/stats')
  @RequirePermission('projects:read')
  @ApiOperation({ summary: 'Get quick stats for a project (e.g. hasPickedCells).' })
  async getStats(@Param('id') id: string) {
    return this.projectsService.getStats(id);
  }

  @Post(':id/experiments')
  @RequirePermission('projects:write')
  @ApiOperation({ summary: 'Create a new experiment (record) under this project.' })
  async createExperiment(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateExperimentDto,
  ) {
    return this.projectsService.createExperiment(id, user.id, dto);
  }

  @Post()
  @RequirePermission('projects:write')
  @ApiOperation({ summary: 'Create a new project, owned by the current user.' })
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
  }

  @Put(':id')
  @RequirePermission('projects:write')
  @ApiOperation({ summary: 'Update a project by ID.' })
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('projects:write')
  @ApiOperation({ summary: 'Delete a project by ID.' })
  async remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Put(':id/members')
  @RequirePermission('projects:write')
  @ApiOperation({
    summary: 'Bulk upsert experimentCollaborators across all experiments in this project.',
  })
  async updateMembers(@Param('id') id: string, @Body() dto: UpdateProjectMembersDto) {
    return this.projectsService.updateMembers(id, dto);
  }
}