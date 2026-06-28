export interface JwtPayload {
  /** users.id */
  sub: string;
  username: string;
  email: string;
  roleId: string | null;
  roleName?: string;
}