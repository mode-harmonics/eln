import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user, role, and menu permissions.' })
  async me(@CurrentUser() user: RequestUser) {
    return this.usersService.getCurrentUser(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of all users.' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user.' })
  async create(@Body() dto: { email: string; fullName: string; roleId?: string }) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing user.' })
  async update(@Param('id') id: string, @Body() dto: { email?: string; fullName?: string; roleId?: string; isActive?: boolean }) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user.' })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}