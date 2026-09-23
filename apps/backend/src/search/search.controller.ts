import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @RequirePermission('experiments:read')
  @ApiOperation({ summary: 'Global search for projects and experiments' })
  async search(@Query('q') query: string, @CurrentUser() user: RequestUser) {
    if (!query || query.trim().length === 0) {
      return { success: true, data: [] };
    }
    const results = await this.searchService.search(query.trim(), user);
    return { success: true, data: results };
  }
}
