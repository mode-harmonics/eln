import { IsString } from 'class-validator';

export class UploadDataDto {
  @IsString()
  experimentId!: string;
}