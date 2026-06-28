import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateExperimentDto {
  @ApiProperty({ description: '实验标题', example: 'Initial Formulation Test' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    description: '记录类型，存入 metadata.recordType',
    example: 'ProcessData',
  })
  @IsString()
  @IsOptional()
  recordType?: string;
}
