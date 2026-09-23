import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { RoleName } from '@eln/shared';

export class AddCollaboratorDto {
  @IsUUID()
  userId!: string;

  @IsEnum(RoleName)
  role!: RoleName;
}

export class AddExperimentCommentDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  content!: string;
}
