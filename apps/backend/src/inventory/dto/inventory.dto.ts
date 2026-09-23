import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { InventoryStatus } from '@eln/shared';

export class CreateInventoryDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lotNumber?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,12}(?:\.\d{1,6})?$/, { message: 'quantity must be a non-negative decimal string with at most 12 integer and 6 fractional digits' })
  quantity?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  storageLocation?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  purity?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;

  @IsOptional()
  @IsDateString({ strict: true })
  lastUsedAt?: string | null;
}

export class UpdateInventoryDto extends PartialType(CreateInventoryDto, { skipNullProperties: false }) {}
