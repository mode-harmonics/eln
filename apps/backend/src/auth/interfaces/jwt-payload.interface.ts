export interface JwtPayload {
  /** users.id */
  sub: string;
  email: string;
  roleId: string | null;
  roleName?: string;
}