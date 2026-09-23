import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, IsUUID, MaxLength, IsNotEmpty, ValidateNested } from 'class-validator';

export class ProjectMemberDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  role!: string;
}

export class UpdateProjectMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectMemberDto)
  members!: ProjectMemberDto[];
}