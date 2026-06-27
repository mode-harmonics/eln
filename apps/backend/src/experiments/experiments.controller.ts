import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubmitExperimentDto, UpdateExperimentDto } from './dto';
import { ExperimentsService } from './experiments.service';

@ApiTags('experiments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('experiments')
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get experiment detail including attachments and collaborators.' })
  async findOne(@Param('id') id: string) {
    return this.experimentsService.findDetail(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Auto-save edit with optimistic-lock check on versionNo.' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateExperimentDto,
  ) {
    return this.experimentsService.update(id, user.id, dto);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit for review: Draft -> In Review, and lock.' })
  async submit(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: SubmitExperimentDto,
  ) {
    return this.experimentsService.submit(id, user.id, dto);
  }
}