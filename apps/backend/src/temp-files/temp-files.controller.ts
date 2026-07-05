import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuid } from 'uuid';

const TEMP_DIR = path.join(os.tmpdir(), 'eln-temp-files');

// Ensure temp dir exists at startup
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// In-memory registry: fileId -> { name, path, size, mimeType, uploadedBy, uploadedAt }
const registry = new Map<string, {
  id: string;
  name: string;
  filePath: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
}>();

@ApiTags('temp-files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('temp-files')
export class TempFilesController {
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '临时上传一个或多个文件（存储于系统临时目录，重启后清空）。' })
  @UseInterceptors(FilesInterceptor('files', 20))
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: RequestUser,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('未选择文件');
    }

    const results = [];
    for (const file of files) {
      const id = uuid();
      const ext = path.extname(file.originalname);
      const filePath = path.join(TEMP_DIR, `${id}${ext}`);
      fs.writeFileSync(filePath, file.buffer);

      const entry = {
        id,
        name: file.originalname,
        filePath,
        size: file.size,
        mimeType: file.mimetype,
        uploadedBy: user.id,
        uploadedAt: new Date().toISOString(),
      };
      registry.set(id, entry);
      results.push({ id, name: entry.name, size: entry.size, mimeType: entry.mimeType, uploadedAt: entry.uploadedAt });
    }

    return results;
  }

  @Get()
  @ApiOperation({ summary: '列出当前会话内所有临时文件。' })
  async list() {
    return Array.from(registry.values()).map(({ id, name, size, mimeType, uploadedBy, uploadedAt }) => ({
      id, name, size, mimeType, uploadedBy, uploadedAt,
    }));
  }

  @Get(':id/download')
  @ApiOperation({ summary: '下载临时文件。' })
  async download(@Param('id') id: string, @Res() res: any) {
    const entry = registry.get(id);
    if (!entry || !fs.existsSync(entry.filePath)) {
      throw new NotFoundException('文件不存在或已过期');
    }
    res.setHeader('Content-Type', entry.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(entry.name)}"`);
    const stream = fs.createReadStream(entry.filePath);
    stream.pipe(res);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除临时文件。' })
  async remove(@Param('id') id: string) {
    const entry = registry.get(id);
    if (!entry) throw new NotFoundException('文件不存在');
    if (fs.existsSync(entry.filePath)) fs.unlinkSync(entry.filePath);
    registry.delete(id);
    return { success: true };
  }
}
