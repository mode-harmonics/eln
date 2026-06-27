import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class UpdateExperimentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  /** Must match the experiment's current versionNo, or the update is rejected with 409. */
  @IsInt()
  @Min(1)
  versionNo!: number;

  @IsOptional()
  @IsString()
  changeSummary?: string;
}