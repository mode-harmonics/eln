import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { InventoryService } from './inventory.service';
import { Inventory } from '../entities/inventory.entity';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermission('data:read')
  @ApiOperation({ summary: 'List all inventory items.' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page as any, 10) : undefined;
    const limitNum = limit ? parseInt(limit as any, 10) : undefined;
    return this.inventoryService.findAll(pageNum, limitNum, search);
  }

  @Get(':id')
  @RequirePermission('data:read')
  @ApiOperation({ summary: 'Get a single inventory item details.' })
  async findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Post()
  @RequirePermission('data:write')
  @ApiOperation({ summary: 'Add a new inventory item.' })
  async create(@Body() dto: Partial<Inventory>) {
    return this.inventoryService.create(dto);
  }

  @Put(':id')
  @RequirePermission('data:write')
  @ApiOperation({ summary: 'Update an existing inventory item.' })
  async update(@Param('id') id: string, @Body() dto: Partial<Inventory>) {
    return this.inventoryService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('data:write')
  @ApiOperation({ summary: 'Delete an inventory item.' })
  async remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }
}
