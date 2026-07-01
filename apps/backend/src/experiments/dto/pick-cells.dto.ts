import { IsArray, IsOptional, IsString } from 'class-validator';

export class PickCellsDto {
  @IsArray()
  @IsString({ each: true })
  cellIds!: string[];

  @IsOptional()
  @IsString()
  mode?: 'auto' | 'manual';
}
