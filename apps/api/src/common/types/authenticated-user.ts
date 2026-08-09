import type { UserStatus } from '@prisma/client';

/** Shape attached to `request.user` by `JwtStrategy` after a token is validated. */
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  mobile: string | null;
  displayName: string | null;
  status: UserStatus;
  locale: string | null;
  /** Role codes, e.g. `['player']`. */
  roles: string[];
  /** `UserSession.id` this access token belongs to. */
  sessionId: string;
}

/** Claims embedded in the signed access token. */
export interface AccessTokenPayload {
  /** Subject — user id. */
  sub: string;
  /** Session id, used for revocation checks. */
  sid: string;
  /** Role codes at issue time. */
  roles: string[];
  /** Token kind discriminator — guards against refresh/access confusion. */
  typ: 'access';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/** Claims embedded in the signed refresh token. */
export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  /** Random per-issue value; its hash is what the session row stores. */
  jti: string;
  typ: 'refresh';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}
