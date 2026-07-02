import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RejectExperimentDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}

export class ApproveExperimentDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
