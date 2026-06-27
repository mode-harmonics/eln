import { IsOptional, IsString } from 'class-validator';

export class SubmitExperimentDto {
  @IsOptional()
  @IsString()
  changeSummary?: string;
}