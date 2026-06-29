import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  color?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsString()
  @IsIn(['prefix', 'manual'])
  matchMode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  matchValue?: string;
}
