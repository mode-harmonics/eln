import { IsOptional, IsString } from 'class-validator';

export class ScrapExperimentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
