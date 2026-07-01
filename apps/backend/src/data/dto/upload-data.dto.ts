import { IsOptional, IsString } from 'class-validator';

export class UploadDataDto {
  @IsString()
  experimentId!: string;

  @IsOptional()
  @IsString()
  mode?: 'overwrite' | 'merge';
}