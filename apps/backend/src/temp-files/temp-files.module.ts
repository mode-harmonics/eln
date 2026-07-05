import { Module } from '@nestjs/common';
import { TempFilesController } from './temp-files.controller';

@Module({
  controllers: [TempFilesController],
})
export class TempFilesModule {}
