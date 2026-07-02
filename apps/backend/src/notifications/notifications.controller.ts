import { Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated notifications for current user' })
  async getMyNotifications(
    @CurrentUser() user: RequestUser,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.notificationsService.getMyNotifications(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: RequestUser) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }
}
