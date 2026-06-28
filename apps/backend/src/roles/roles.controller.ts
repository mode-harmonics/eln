import { Controller, Get, Put, UseGuards, Query, Body, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) { }

  @Get()
  @ApiOperation({ summary: 'List the global RBAC role matrix (for Admin config UIs).' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page as any, 10) : undefined;
    const limitNum = limit ? parseInt(limit as any, 10) : undefined;
    return this.rolesService.findAll(pageNum, limitNum, search);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a role permission list.' })
  async update(
    @Param('id') id: string,
    @Body() dto: { permissionList: string[] },
  ) {
    return this.rolesService.update(id, dto.permissionList);
  }
}