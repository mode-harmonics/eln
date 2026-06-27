import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from '../entities';
import { DataController } from './data.controller';
import { DataService } from './data.service';
import { ParserRegistry } from './parsers/parser.registry';

@Module({
  imports: [
    TypeOrmModule.forFeature(Object.values(entities)),
    // In-memory storage: ExcelJS reads the buffer directly, no temp file
    // written to disk. Fine for MVP-scale workbooks; revisit with disk
    // storage + streaming if uploads grow very large.
    MulterModule.register({
      storage: undefined, // default memoryStorage
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB cap
    }),
  ],
  controllers: [DataController],
  providers: [DataService, ParserRegistry],
  exports: [DataService],
})
export class DataModule {}