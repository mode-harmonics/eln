import { UpdateProcurementDto as UpdateProcurementContract } from '@eln/shared';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateProcurementDto implements UpdateProcurementContract {
  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  batchNo?: string;

  @IsOptional()
  @IsString()
  purity?: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsOptional()
  @IsBoolean()
  isValid?: boolean;

  @IsOptional()
  @IsString()
  remark?: string;
}