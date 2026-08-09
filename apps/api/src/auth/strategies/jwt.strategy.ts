import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy, type StrategyOptions } from 'passport-jwt';

import { REDIS_KEY } from '../../common/constants';
import { UnauthorizedDomainException } from '../../common/exceptions/domain.exception';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
} from '../../common/types/authenticated-user';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/** How long a resolved principal may be reused before re-reading the database. */
const PRINCIPAL_CACHE_SECONDS = 30;

/**
 * Access-token strategy.
 *
 * A valid signature is not sufficient. Every request additionally confirms that:
 *  - the session has not been revoked (logout, logout-all, admin action),
 *  - the session has not expired,
 *  - the account is still ACTIVE.
 *
 * The resolved principal is cached in Redis for a few seconds to keep the hot path
 * off the database, but revocation is *not* subject to that delay: logout writes a
 * tombstone key that is checked on every single request.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    };

    super(options);
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.typ !== 'access') {
      throw new UnauthorizedDomainException(
        'This token cannot be used to authorize API calls.',
        'WRONG_TOKEN_TYPE',
      );
    }

    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedDomainException('Token is missing required claims.', 'MALFORMED_TOKEN');
    }

    // Revocation tombstone — checked before anything cached.
    if (await this.redis.exists(REDIS_KEY.sessionRevoked(payload.sid))) {
      throw new UnauthorizedDomainException(
        'This session has been signed out. Sign in again.',
        'SESSION_REVOKED',
      );
    }

    const cacheKey = `principal:${payload.sid}`;
    const cached = await this.redis.getJson<AuthenticatedUser>(cacheKey);

    if (cached) {
      return cached;
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedDomainException('Session not found.', 'SESSION_NOT_FOUND');
    }

    if (session.revokedAt !== null) {
      throw new UnauthorizedDomainException(
        'This session has been signed out. Sign in again.',
        'SESSION_REVOKED',
      );
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedDomainException('Session has expired.', 'SESSION_EXPIRED');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        mobile: true,
        displayName: true,
        status: true,
        locale: true,
        deletedAt: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedDomainException('Account no longer exists.', 'ACCOUNT_NOT_FOUND');
    }

    this.assertUsableStatus(user.status);

    const principal: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      displayName: user.displayName,
      status: user.status,
      locale: user.locale,
      roles: user.userRoles.map((assignment) => assignment.role.code),
      sessionId: session.id,
    };

    await this.redis.setJson(cacheKey, principal, PRINCIPAL_CACHE_SECONDS);

    return principal;
  }

  private assertUsableStatus(status: UserStatus): void {
    switch (status) {
      case UserStatus.ACTIVE:
        return;
      case UserStatus.SUSPENDED:
        throw new UnauthorizedDomainException(
          'This account is suspended. Contact support.',
          'ACCOUNT_SUSPENDED',
        );
      case UserStatus.SELF_EXCLUDED:
        throw new UnauthorizedDomainException(
          'This account is under self-exclusion and cannot be accessed until the period ends.',
          'ACCOUNT_SELF_EXCLUDED',
        );
      default:
        throw new UnauthorizedDomainException(
          'This account is not active.',
          'ACCOUNT_INACTIVE',
        );
    }
  }
}
