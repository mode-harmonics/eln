import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  BatchCreateDesignDto as SharedBatchCreateDesignDto,
  CreateExperimentDesignDto as SharedCreateExperimentDesignDto,
} from '@eln/shared';

export class CreateExperimentDesignDto implements SharedCreateExperimentDesignDto {
  @IsString()
  group!: string;

  @IsString()
  moleculeName!: string;

  @IsString()
  chineseName!: string;

  @IsOptional()
  @IsString()
  molecularStructure?: string;

  @IsString()
  cas!: string;

  @IsOptional()
  @IsString()
  designPrinciple?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cellCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  redundancyCount?: number;
}

export class BatchCreateDesignDto implements SharedBatchCreateDesignDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExperimentDesignDto)
  groups!: CreateExperimentDesignDto[];
}

export class UpdateExperimentDesignDto {
  @IsOptional()
  @IsString()
  group?: string;

  @IsOptional()
  @IsString()
  moleculeName?: string;

  @IsOptional()
  @IsString()
  chineseName?: string;

  @IsOptional()
  @IsString()
  molecularStructure?: string;

  @IsOptional()
  @IsString()
  cas?: string;

  @IsOptional()
  @IsString()
  designPrinciple?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  redundancyCount?: number;
}