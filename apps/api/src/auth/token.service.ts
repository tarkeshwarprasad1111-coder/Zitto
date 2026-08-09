import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

import { UnauthorizedDomainException } from '../common/exceptions/domain.exception';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../common/types/authenticated-user';
import { AppConfigService } from '../config/app-config.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  /** SHA-256 of the refresh token's `jti`, to persist on `UserSession`. */
  refreshTokenHash: string;
  /** Absolute expiry for the refresh token, for `UserSession.expiresAt`. */
  refreshExpiresAt: Date;
}

/**
 * Issues and verifies the JWT pair.
 *
 * Design notes:
 *  - Access and refresh tokens are signed with **different secrets** and carry a
 *    `typ` claim, so a refresh token can never be replayed as an access token.
 *  - Only the SHA-256 of the refresh token's `jti` is stored. The tokens are
 *    high-entropy random values, so a fast hash is the correct choice here —
 *    Argon2 is for low-entropy human passwords, not 256-bit random ids.
 *  - Refresh tokens are single-use: `AuthService.refresh` rotates them.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  /** Signs a fresh access + refresh pair for a session. */
  async issuePair(params: {
    userId: string;
    sessionId: string;
    roles: string[];
  }): Promise<TokenPair> {
    const { accessSecret, refreshSecret, accessTtl, refreshTtl, issuer, audience } =
      this.config.jwt;

    const jti = `${uuidv4()}.${randomBytes(24).toString('base64url')}`;

    const accessPayload: AccessTokenPayload = {
      sub: params.userId,
      sid: params.sessionId,
      roles: params.roles,
      typ: 'access',
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: params.userId,
      sid: params.sessionId,
      jti,
      typ: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessTtl,
        issuer,
        audience,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshTtl,
        issuer,
        audience,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTtl,
      tokenType: 'Bearer',
      refreshTokenHash: this.hashToken(jti),
      refreshExpiresAt: new Date(Date.now() + refreshTtl * 1000),
    };
  }

  /** Verifies an access token. Used by the Passport strategy. */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const { accessSecret, issuer, audience } = this.config.jwt;

    const payload = await this.verify<AccessTokenPayload>(token, accessSecret, issuer, audience);

    if (payload.typ !== 'access') {
      throw new UnauthorizedDomainException(
        'This token cannot be used to authorize API calls.',
        'WRONG_TOKEN_TYPE',
      );
    }

    return payload;
  }

  /** Verifies a refresh token presented at the rotation endpoint. */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const { refreshSecret, issuer, audience } = this.config.jwt;

    const payload = await this.verify<RefreshTokenPayload>(
      token,
      refreshSecret,
      issuer,
      audience,
    );

    if (payload.typ !== 'refresh') {
      throw new UnauthorizedDomainException(
        'This token cannot be used to refresh a session.',
        'WRONG_TOKEN_TYPE',
      );
    }

    if (!payload.jti || !payload.sid) {
      throw new UnauthorizedDomainException('Refresh token is malformed.', 'MALFORMED_TOKEN');
    }

    return payload;
  }

  /** SHA-256 hex. The stored form of a refresh token's `jti`. */
  hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async verify<T extends object>(
    token: string,
    secret: string,
    issuer: string,
    audience: string,
  ): Promise<T> {
    try {
      return await this.jwt.verifyAsync<T>(token, { secret, issuer, audience });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';

      if (name === 'TokenExpiredError') {
        throw new UnauthorizedDomainException('Token has expired.', 'TOKEN_EXPIRED');
      }

      this.logger.debug(`Token verification failed: ${name}`);
      throw new UnauthorizedDomainException('Token is invalid.', 'TOKEN_INVALID');
    }
  }
}
