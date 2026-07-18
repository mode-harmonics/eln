import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CellAssignmentDto {
  @IsString()
  cellId!: string;

  @IsString()
  testType!: string;
}

export class PickCellsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cellIds?: string[];

  @IsOptional()
  @IsString()
  mode?: 'auto' | 'manual';

  @IsOptional()
  @IsInt()
  @Min(1)
  topN?: number;

  /** Per-cell test type assignments for manual mode */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CellAssignmentDto)
  assignments?: CellAssignmentDto[];
}
