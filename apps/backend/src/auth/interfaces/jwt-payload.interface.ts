export interface JwtPayload {
  /** users.id */
  sub: string;
  username: string;
  email: string | null;
  roleId: string | null;
  roleName?: string;
}