import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, UseInterceptors, UploadedFile, Res, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { SubmitExperimentDto, UpdateExperimentDto, ApproveExperimentDto, RejectExperimentDto } from './dto';
import { ExperimentsService } from './experiments.service';

@ApiTags('experiments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('experiments')
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get experiment detail including attachments and collaborators.' })
  async findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.experimentsService.findDetail(id, userId);
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

  @Delete(':id')
  @RequirePermission('experiments:write')
  @ApiOperation({ summary: 'Delete an experiment and all associated data (attachments, collaborators, version history).' })
  async remove(@Param('id') id: string) {
    return this.experimentsService.remove(id);
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

  @Post(':id/approve')
  @RequirePermission('experiments:approve')
  @ApiOperation({ summary: 'Approve an experiment.' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ApproveExperimentDto,
  ) {
    return this.experimentsService.approve(id, user.id, dto.comment);
  }

  @Post(':id/reject')
  @RequirePermission('experiments:approve')
  @ApiOperation({ summary: 'Reject an experiment.' })
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RejectExperimentDto,
  ) {
    return this.experimentsService.reject(id, user.id, dto.reason);
  }

  @Post(':id/archive')
  @RequirePermission('experiments:archive')
  @ApiOperation({ summary: 'Archive an experiment.' })
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.experimentsService.archive(id, user.id);
  }

  @Get(':id/collaborators')
  @ApiOperation({ summary: 'Get collaborators for an experiment.' })
  async getCollaborators(@Param('id') id: string) {
    return this.experimentsService.getCollaborators(id);
  }

  @Post(':id/collaborators')
  @ApiOperation({ summary: 'Add a collaborator to an experiment.' })
  async addCollaborator(
    @Param('id') id: string,
    @Body() body: { userId: string; role: string },
  ) {
    return this.experimentsService.addCollaborator(id, body.userId, body.role);
  }

  @Delete(':id/collaborators/:userId')
  @ApiOperation({ summary: 'Remove a collaborator from an experiment.' })
  async removeCollaborator(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.experimentsService.removeCollaborator(id, userId);
  }

  // --- Version History ---

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get version history for an experiment.' })
  async getVersions(@Param('id') id: string) {
    return this.experimentsService.getVersions(id);
  }

  // --- Attachments ---

  @Get(':id/attachments')
  @ApiOperation({ summary: 'Get attachments for an experiment.' })
  async getAttachments(@Param('id') id: string) {
    const detail = await this.experimentsService.findDetail(id);
    return detail.attachments;
  }

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload an attachment to an experiment.' })
  async uploadAttachment(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');
    return this.experimentsService.uploadAttachment(id, user.id, file);
  }

  @Get(':id/attachments/:attachmentId/download')
  @ApiOperation({ summary: 'Download an attachment.' })
  async downloadAttachment(
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const attachment = await this.experimentsService.getAttachment(attachmentId);
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
    });
    const stream = createReadStream(attachment.filePath);
    stream.pipe(res);
  }

  @Delete(':id/attachments/:attachmentId')
  @ApiOperation({ summary: 'Delete an attachment.' })
  async deleteAttachment(@Param('attachmentId') attachmentId: string) {
    return this.experimentsService.deleteAttachment(attachmentId);
  }

  // --- Comments ---

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments for an experiment.' })
  async getComments(@Param('id') id: string) {
    return this.experimentsService.getComments(id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to an experiment.' })
  async addComment(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { content: string },
  ) {
    if (!body.content?.trim()) {
      throw new BadRequestException('Comment content cannot be empty.');
    }
    return this.experimentsService.addComment(id, user.id, body.content.trim());
  }
}