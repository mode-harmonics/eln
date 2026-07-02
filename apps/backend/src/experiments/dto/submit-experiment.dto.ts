import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SubmitExperimentDto {
  @IsOptional()
  @IsString()
  changeSummary?: string;

  @IsOptional()
  @IsUUID()
  reviewerId?: string;
}