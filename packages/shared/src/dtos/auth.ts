import { RoleName } from '../enums';

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: RoleName | string;
  };
}

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  avatar: string | null;
  roleId: string | null;
  departmentId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CurrentUserDto extends UserDto {
  permissionList: string[];
}