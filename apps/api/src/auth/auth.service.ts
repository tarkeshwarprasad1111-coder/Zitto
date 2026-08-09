import { Injectable, Logger } from '@nestjs/common';
import { ActorType, LedgerType, Prisma, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

import { AuditService } from '../common/audit/audit.service';
import { LEDGER_SOURCE, REDIS_KEY, ROLE } from '../common/constants';
import {
  ConflictDomainException,
  NotFoundDomainException,
  UnauthorizedDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import type {
  AuthUserDto,
  LoginResponseDto,
  RegisterResponseDto,
  TokenPairDto,
  VerifyOtpResponseDto,
} from './dto/auth-response.dto';
import type {
  Channel,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { maskTarget, OtpService } from './otp.service';
import { TokenService } from './token.service';

/** Ambient request facts every auth mutation records. */
export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  correlationId?: string | null;
}

const USER_SELECT = {
  id: true,
  email: true,
  mobile: true,
  displayName: true,
  status: true,
  locale: true,
  emailVerifiedAt: true,
  mobileVerifiedAt: true,
  deletedAt: true,
  userRoles: { select: { role: { select: { code: true } } } },
} satisfies Prisma.UserSelect;

type UserWithRoles = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

/**
 * Account lifecycle: registration, verification, sessions, password recovery.
 *
 * ## Security posture
 *
 * - Passwords are Argon2id with the OWASP-recommended parameters (19 MiB, t=2).
 * - Login does not reveal whether an identifier exists. A miss still performs a
 *   hash verification against a decoy so response timing does not leak either.
 * - Refresh tokens are single-use and rotated. Presenting an already-rotated
 *   token is treated as theft: every session for that user is revoked at once.
 * - Password reset never confirms whether an account exists.
 * - Signup bonus is granted only after verification, and only through
 *   `WalletService`, keyed so it can never be granted twice.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Decoy hash for constant-work login misses. Built once, lazily. */
  private decoyHash: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly wallet: WalletService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────────── Registration ─────────────────────────────

  /**
   * Creates an unverified account.
   *
   * The user, their zero-balance wallet, their preferences and their `player`
   * role are written in one transaction — a half-created account with no wallet
   * would break every later money path.
   *
   * No tokens are issued here. The account is unusable until `verifyOtp`
   * succeeds, which is also when the signup bonus is credited.
   */
  async register(dto: RegisterDto, ctx: RequestContext): Promise<RegisterResponseDto> {
    const channel: Channel = dto.email ? 'email' : 'mobile';
    const target = (dto.email ?? dto.mobile) as string;

    await this.assertIdentifierAvailable(dto.email, dto.mobile);

    const passwordHash = await this.hashPassword(dto.password);

    const playerRole = await this.prisma.role.findUnique({
      where: { code: ROLE.PLAYER },
      select: { id: true },
    });

    if (!playerRole) {
      // Seeds have not run. Failing loudly beats creating role-less accounts.
      throw new Error(
        `Role "${ROLE.PLAYER}" is missing. Run \`pnpm prisma:seed\` before serving traffic.`,
      );
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email ?? null,
          mobile: dto.mobile ?? null,
          passwordHash,
          displayName: dto.displayName,
          locale: dto.locale,
          timezone: dto.timezone,
          status: UserStatus.ACTIVE,
          // The DTO makes this a required literal `true`, so reaching here means confirmed.
          ageConfirmedAt: new Date(),
        },
        select: USER_SELECT,
      });

      await tx.userRole.create({
        data: { userId: created.id, roleId: playerRole.id },
      });

      // Wallet starts empty. The signup bonus arrives as a ledger entry after
      // verification, so the very first row in the ledger explains the balance.
      await tx.virtualWallet.create({
        data: { userId: created.id, balance: 0n, locked: 0n, bonus: 0n },
      });

      // Column defaults own the preference values; we only establish the row.
      await tx.userPreference.create({ data: { userId: created.id } });

      if (dto.deviceId) {
        await tx.userDevice.create({
          data: { userId: created.id, deviceId: dto.deviceId, lastSeenAt: new Date() },
        });
      }

      await this.audit.recordTx(tx, {
        actorType: ActorType.USER,
        actorId: created.id,
        action: 'auth.register',
        targetType: 'user',
        targetId: created.id,
        payload: {
          channel,
          maskedTarget: maskTarget(channel, target),
          locale: dto.locale,
          // Referral attribution is resolved by the rewards module (Milestone 5);
          // the submitted code is preserved here so nothing is lost meanwhile.
          referralCode: dto.referralCode ?? null,
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        correlationId: ctx.correlationId,
      });

      return created;
    });

    const issued = await this.otp.issueVerification({
      userId: user.id,
      channel,
      target,
      ip: ctx.ip,
    });

    return {
      user: this.toAuthUser(user),
      verificationChannel: channel,
      verificationTarget: issued.maskedTarget,
      expiresIn: issued.expiresIn,
    };
  }

  /**
   * Confirms ownership of the email or mobile, activates the account, grants the
   * signup bonus, and signs the user in.
   */
  async verifyOtp(dto: VerifyOtpDto, ctx: RequestContext): Promise<VerifyOtpResponseDto> {
    const target = this.normalizeTarget(dto.channel, dto.target);
    const user = await this.findByIdentifier(dto.channel, target);

    if (!user) {
      throw new NotFoundDomainException('Account', maskTarget(dto.channel, target));
    }

    const alreadyVerified =
      dto.channel === 'email' ? user.emailVerifiedAt !== null : user.mobileVerifiedAt !== null;

    if (alreadyVerified) {
      throw new ConflictDomainException(
        'This contact has already been verified. Sign in instead.',
        'ALREADY_VERIFIED',
      );
    }

    await this.otp.verifyCode({
      userId: user.id,
      channel: dto.channel,
      target,
      code: dto.code,
    });

    const verifiedAt = new Date();

    await this.prisma.user.update({
      where: { id: user.id },
      data:
        dto.channel === 'email'
          ? { emailVerifiedAt: verifiedAt }
          : { mobileVerifiedAt: verifiedAt },
    });

    // Idempotent by construction: one signup bonus per user id, ever.
    const bonusAmount = this.config.economy.signupBonus;
    let signupBonusCoins: string | null = null;

    if (bonusAmount > 0n) {
      const grant = await this.wallet.credit({
        userId: user.id,
        amount: bonusAmount,
        type: LedgerType.SIGNUP_BONUS,
        sourceType: LEDGER_SOURCE.SIGNUP,
        sourceId: user.id,
        idempotencyKey: `signup-bonus:${user.id}`,
        actorType: ActorType.SYSTEM,
        actorId: null,
        metadata: { channel: dto.channel, verifiedAt: verifiedAt.toISOString() },
      });

      signupBonusCoins = grant.replayed ? null : bonusAmount.toString();
    }

    const tokens = await this.startSession(user, { ...ctx, deviceId: dto.deviceId ?? ctx.deviceId });

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: user.id,
      action: 'auth.verify_otp',
      targetType: 'user',
      targetId: user.id,
      payload: { channel: dto.channel, signupBonusGranted: signupBonusCoins !== null },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    const refreshed = await this.requireUser(user.id);

    return {
      user: this.toAuthUser(refreshed),
      tokens,
      signupBonusCoins,
    };
  }

  /** Reissues a verification code. Rate-limited by the OTP cooldown. */
  async resendOtp(dto: ResendOtpDto, ctx: RequestContext): Promise<{ message: string; expiresIn: number }> {
    const target = this.normalizeTarget(dto.channel, dto.target);
    const user = await this.findByIdentifier(dto.channel, target);

    // Do not confirm or deny the account's existence.
    const genericMessage = `If an unverified account exists for ${maskTarget(
      dto.channel,
      target,
    )}, a new code has been sent.`;

    if (!user) {
      return { message: genericMessage, expiresIn: this.config.otp.ttlSeconds };
    }

    const alreadyVerified =
      dto.channel === 'email' ? user.emailVerifiedAt !== null : user.mobileVerifiedAt !== null;

    if (alreadyVerified) {
      return { message: genericMessage, expiresIn: this.config.otp.ttlSeconds };
    }

    const issued = await this.otp.issueVerification({
      userId: user.id,
      channel: dto.channel,
      target,
      ip: ctx.ip,
    });

    return { message: genericMessage, expiresIn: issued.expiresIn };
  }

  // ───────────────────────────── Sessions ─────────────────────────────

  /** Password sign-in. Issues a fresh session and token pair. */
  async login(dto: LoginDto, ctx: RequestContext): Promise<LoginResponseDto> {
    const channel: Channel = dto.email ? 'email' : 'mobile';
    const target = this.normalizeTarget(channel, (dto.email ?? dto.mobile) as string);

    const record = await this.prisma.user.findFirst({
      where:
        channel === 'email'
          ? { email: target, deletedAt: null }
          : { mobile: target, deletedAt: null },
      select: { ...USER_SELECT, passwordHash: true },
    });

    // Always spend comparable time, whether or not the account exists.
    const valid = record
      ? await this.verifyPassword(record.passwordHash, dto.password)
      : await this.burnVerification(dto.password);

    if (!record || !valid) {
      await this.audit.record({
        actorType: ActorType.SYSTEM,
        actorId: record?.id ?? null,
        action: 'auth.login_failed',
        targetType: 'user',
        targetId: record?.id ?? null,
        payload: { channel, maskedTarget: maskTarget(channel, target) },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        correlationId: ctx.correlationId,
      });

      throw new UnauthorizedDomainException(
        'Those credentials are not valid.',
        'INVALID_CREDENTIALS',
      );
    }

    this.assertLoginAllowed(record.status);

    const verified = record.emailVerifiedAt !== null || record.mobileVerifiedAt !== null;

    if (!verified) {
      throw new ValidationDomainException(
        'Verify your email or mobile number before signing in.',
        'ACCOUNT_NOT_VERIFIED',
      );
    }

    const tokens = await this.startSession(record, ctx);

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: record.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: record.id,
      payload: { channel },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    return { user: this.toAuthUser(record), tokens };
  }

  /**
   * Rotates a refresh token.
   *
   * The presented token must match the hash stored on a live session. On success
   * the old session is revoked and a brand-new one is issued, so a stolen token
   * is usable at most once.
   *
   * If a token verifies cryptographically but does not match the stored hash, the
   * session has already been rotated — the classic signature of a replayed,
   * stolen token. Every session for that user is revoked immediately.
   */
  async refresh(dto: RefreshDto, ctx: RequestContext): Promise<LoginResponseDto> {
    const payload = await this.tokens.verifyRefreshToken(dto.refreshToken);

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
      select: {
        id: true,
        userId: true,
        refreshTokenHash: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedDomainException('Session not found.', 'SESSION_NOT_FOUND');
    }

    if (session.revokedAt !== null) {
      await this.handleTokenReuse(session.userId, ctx, 'revoked_session');
      throw new UnauthorizedDomainException(
        'This session has been signed out. Sign in again.',
        'SESSION_REVOKED',
      );
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedDomainException('Session has expired.', 'SESSION_EXPIRED');
    }

    if (session.refreshTokenHash !== this.tokens.hashToken(payload.jti)) {
      await this.handleTokenReuse(session.userId, ctx, 'stale_token');
      throw new UnauthorizedDomainException(
        'This refresh token has already been used. All sessions have been signed out as a precaution.',
        'REFRESH_TOKEN_REUSED',
      );
    }

    const user = await this.requireUser(session.userId);
    this.assertLoginAllowed(user.status);

    const newSessionId = await this.prisma.$transaction(async (tx) => {
      await tx.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      const next = await tx.userSession.create({
        data: {
          userId: user.id,
          // Placeholder until the pair is signed; overwritten below in the same flow.
          refreshTokenHash: '',
          deviceFingerprint: ctx.deviceId ?? null,
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
          expiresAt: new Date(Date.now() + this.config.jwt.refreshTtl * 1000),
        },
        select: { id: true },
      });

      return next.id;
    });

    const pair = await this.tokens.issuePair({
      userId: user.id,
      sessionId: newSessionId,
      roles: user.userRoles.map((assignment) => assignment.role.code),
    });

    await this.prisma.userSession.update({
      where: { id: newSessionId },
      data: {
        refreshTokenHash: pair.refreshTokenHash,
        expiresAt: pair.refreshExpiresAt,
      },
    });

    // Kill any access token still riding the old session id.
    await this.tombstoneSession(session.id);

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: user.id,
      action: 'auth.refresh',
      targetType: 'user_session',
      targetId: newSessionId,
      payload: { rotatedFrom: session.id },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    return {
      user: this.toAuthUser(user),
      tokens: this.toTokenPair(pair),
    };
  }

  /** Ends the caller's current session. */
  async logout(
    userId: string,
    sessionId: string,
    ctx: RequestContext,
  ): Promise<{ message: string }> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.tombstoneSession(sessionId);

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: userId,
      action: 'auth.logout',
      targetType: 'user_session',
      targetId: sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    return { message: 'Signed out.' };
  }

  /** Ends every session for the account, on every device. */
  async logoutAll(userId: string, ctx: RequestContext): Promise<{ message: string; revoked: number }> {
    const revoked = await this.revokeAllSessions(userId);

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: userId,
      action: 'auth.logout_all',
      targetType: 'user',
      targetId: userId,
      payload: { revokedSessions: revoked },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    return {
      message: `Signed out of ${revoked} session${revoked === 1 ? '' : 's'}.`,
      revoked,
    };
  }

  // ───────────────────────────── Password recovery ─────────────────────────────

  /**
   * Starts password recovery.
   *
   * The response is identical whether or not the account exists — this endpoint is
   * unauthenticated and must not be usable to enumerate users.
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
    ctx: RequestContext,
  ): Promise<{ message: string; expiresIn: number }> {
    const target = this.normalizeTarget(dto.channel, dto.target);
    const user = await this.findByIdentifier(dto.channel, target);

    const message = `If an account exists for ${maskTarget(
      dto.channel,
      target,
    )}, a reset code has been sent.`;

    if (!user || user.status === UserStatus.DELETED) {
      return { message, expiresIn: this.config.otp.ttlSeconds };
    }

    const issued = await this.otp.issuePasswordReset({
      userId: user.id,
      channel: dto.channel,
      target,
    });

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: user.id,
      action: 'auth.forgot_password',
      targetType: 'user',
      targetId: user.id,
      payload: { channel: dto.channel },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    return { message, expiresIn: issued.expiresIn };
  }

  /**
   * Completes password recovery.
   *
   * Every existing session is revoked: if the reset was triggered because the
   * account was compromised, leaving the attacker's session alive would defeat it.
   */
  async resetPassword(
    dto: ResetPasswordDto,
    ctx: RequestContext,
  ): Promise<{ message: string }> {
    const target = this.normalizeTarget(dto.channel, dto.target);

    const { userId } = await this.otp.consumePasswordReset({
      channel: dto.channel,
      target,
      code: dto.code,
    });

    const passwordHash = await this.hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    const revoked = await this.revokeAllSessions(userId);

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: userId,
      action: 'auth.reset_password',
      targetType: 'user',
      targetId: userId,
      payload: { channel: dto.channel, revokedSessions: revoked },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    return {
      message: 'Password updated. All sessions have been signed out — sign in with the new password.',
    };
  }

  // ───────────────────────────── Internals ─────────────────────────────

  /** Creates a session row and signs the token pair bound to it. */
  private async startSession(
    user: UserWithRoles,
    ctx: RequestContext,
  ): Promise<TokenPairDto> {
    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: '',
        deviceFingerprint: ctx.deviceId ?? null,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        expiresAt: new Date(Date.now() + this.config.jwt.refreshTtl * 1000),
      },
      select: { id: true },
    });

    const pair = await this.tokens.issuePair({
      userId: user.id,
      sessionId: session.id,
      roles: user.userRoles.map((assignment) => assignment.role.code),
    });

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: pair.refreshTokenHash, expiresAt: pair.refreshExpiresAt },
    });

    if (ctx.deviceId) {
      await this.touchDevice(user.id, ctx.deviceId);
    }

    return this.toTokenPair(pair);
  }

  private async touchDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await this.prisma.userDevice.upsert({
        where: { userId_deviceId: { userId, deviceId } },
        create: { userId, deviceId, lastSeenAt: new Date() },
        update: { lastSeenAt: new Date() },
      });
    } catch (error) {
      // Device tracking is telemetry, not authorization. Never fail a login for it.
      this.logger.warn(
        `Could not record device for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Revokes every live session and tombstones them so access tokens die at once.
   *
   * Public because self-exclusion and admin suspension must also be able to cut
   * a user off immediately — those flows live in other modules.
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      select: { id: true },
    });

    if (sessions.length === 0) {
      return 0;
    }

    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await Promise.all(sessions.map((session) => this.tombstoneSession(session.id)));

    return sessions.length;
  }

  /**
   * Marks a session dead in Redis for the access-token lifetime.
   *
   * Access tokens are stateless and short-lived; without this marker a revoked
   * session would stay usable until natural expiry. The TTL only needs to cover
   * that window — after it, the token is expired anyway.
   */
  private async tombstoneSession(sessionId: string): Promise<void> {
    await Promise.all([
      this.redis.set(
        REDIS_KEY.sessionRevoked(sessionId),
        '1',
        this.config.jwt.accessTtl + 60,
      ),
      this.redis.del(`principal:${sessionId}`),
    ]);
  }

  private async handleTokenReuse(
    userId: string,
    ctx: RequestContext,
    reason: string,
  ): Promise<void> {
    const revoked = await this.revokeAllSessions(userId);

    this.logger.warn(
      `Refresh token reuse detected for user ${userId} (${reason}); revoked ${revoked} session(s).`,
    );

    await this.audit.record({
      actorType: ActorType.SYSTEM,
      actorId: userId,
      action: 'auth.refresh_token_reuse_detected',
      targetType: 'user',
      targetId: userId,
      payload: { reason, revokedSessions: revoked },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });
  }

  private async assertIdentifierAvailable(
    email?: string,
    mobile?: string,
  ): Promise<void> {
    const clauses: Prisma.UserWhereInput[] = [];
    if (email) clauses.push({ email });
    if (mobile) clauses.push({ mobile });

    const existing = await this.prisma.user.findFirst({
      where: { OR: clauses },
      select: { id: true, email: true, mobile: true },
    });

    if (!existing) {
      return;
    }

    const field = email && existing.email === email ? 'email address' : 'mobile number';

    throw new ConflictDomainException(
      `An account with this ${field} already exists. Sign in or reset your password.`,
      'IDENTIFIER_TAKEN',
    );
  }

  private assertLoginAllowed(status: UserStatus): void {
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
          'This account is under self-exclusion and cannot be used until that period ends.',
          'ACCOUNT_SELF_EXCLUDED',
        );
      default:
        throw new UnauthorizedDomainException('This account is not active.', 'ACCOUNT_INACTIVE');
    }
  }

  private async findByIdentifier(
    channel: Channel,
    target: string,
  ): Promise<UserWithRoles | null> {
    return this.prisma.user.findFirst({
      where:
        channel === 'email'
          ? { email: target, deletedAt: null }
          : { mobile: target, deletedAt: null },
      select: USER_SELECT,
    });
  }

  private async requireUser(userId: string): Promise<UserWithRoles> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundDomainException('User', userId);
    }

    return user;
  }

  private normalizeTarget(channel: Channel, target: string): string {
    return channel === 'email' ? target.trim().toLowerCase() : target.trim();
  }

  private async hashPassword(password: string): Promise<string> {
    const { memoryCost, timeCost, parallelism } = this.config.argon2;
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost,
      timeCost,
      parallelism,
    });
  }

  private async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Performs a real verification against a decoy so misses cost the same. */
  private async burnVerification(password: string): Promise<false> {
    this.decoyHash ??= await this.hashPassword(
      `decoy:${Math.random().toString(36).slice(2)}`,
    );
    await this.verifyPassword(this.decoyHash, password);
    return false;
  }

  private toTokenPair(pair: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }): TokenPairDto {
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresIn: pair.expiresIn,
      tokenType: 'Bearer',
    };
  }

  private toAuthUser(user: UserWithRoles): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      displayName: user.displayName,
      status: user.status,
      locale: user.locale,
      roles: user.userRoles.map((assignment) => assignment.role.code),
      verified: user.emailVerifiedAt !== null || user.mobileVerifiedAt !== null,
    };
  }
}
