import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { OmitType, PartialType } from '@nestjs/swagger';

export class CreateUserDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+$/)
  @MaxLength(64)
  username!: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsEmail()
  @MaxLength(128)
  email?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  fullName!: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(72)
  password!: string;
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const), { skipNullProperties: false }) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;
}
