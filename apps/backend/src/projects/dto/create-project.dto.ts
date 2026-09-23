import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { ProjectStatus } from '@eln/shared';

export class CreateProjectDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
