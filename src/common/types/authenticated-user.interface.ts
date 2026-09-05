export interface AuthenticatedUser {
  /** User id (subject of the JWT). */
  sub: string;
  email: string;
}
