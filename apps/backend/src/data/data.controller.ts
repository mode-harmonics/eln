import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DataService } from './data.service';
import { UploadDataDto } from './dto/upload-data.dto';

@ApiTags('data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('data')
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a multi-sheet Excel workbook; parses and inserts into the 7 battery-data tables.',
  })
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadDataDto) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Expected multipart field "file".');
    }
    return this.dataService.uploadWorkbook(file.buffer, dto.experimentId);
  }

  @Get(':type/:expId')
  @ApiOperation({
    summary: 'Query rows for a business table by type (process/calendar/swelling/efficiency/dcr/fastcharge/htcycle) and experiment.',
  })
  async findByType(@Param('type') type: string, @Param('expId') expId: string) {
    return this.dataService.findByType(type, expId);
  }
}