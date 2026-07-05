import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

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
}
