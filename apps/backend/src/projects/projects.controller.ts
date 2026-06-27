import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateProjectDto, UpdateProjectMembersDto } from './dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: "List projects visible to the current user's membership/ownership." })
  async findAll(@CurrentUser() user: RequestUser) {
    return this.projectsService.findVisibleToUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project, owned by the current user.' })
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
  }

  @Put(':id/members')
  @ApiOperation({
    summary: 'Bulk upsert experimentCollaborators across all experiments in this project.',
  })
  async updateMembers(@Param('id') id: string, @Body() dto: UpdateProjectMembersDto) {
    return this.projectsService.updateMembers(id, dto);
  }
}