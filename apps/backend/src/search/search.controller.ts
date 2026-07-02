import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global search for projects and experiments' })
  async search(@Query('q') query: string) {
    if (!query || query.trim().length === 0) {
      return { success: true, data: [] };
    }
    const results = await this.searchService.search(query.trim());
    return { success: true, data: results };
  }
}
