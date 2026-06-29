import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@ApiTags('groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects/:projectId/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOperation({ summary: 'List all cell groups for a project.' })
  async findAll(@Param('projectId') projectId: string) {
    return this.groupsService.findByProject(projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new cell group for a project.' })
  async create(@Param('projectId') projectId: string, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(projectId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a cell group.' })
  async update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a cell group and its manual members.' })
  async remove(@Param('id') id: string) {
    await this.groupsService.delete(id);
    return { success: true };
  }

  @Post('resolve')
  @ApiOperation({ summary: 'Trigger re-resolution of cell groups (no-op, dynamic resolution is always current).' })
  async resolve(@Param('projectId') projectId: string) {
    // Dynamic resolution is always live; this endpoint exists for
    // future cache-invalidation needs.
    return { success: true, projectId };
  }
}
