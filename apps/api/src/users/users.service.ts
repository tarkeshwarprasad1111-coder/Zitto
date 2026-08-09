import { Injectable, Logger } from '@nestjs/common';
import { ActorType, Prisma, UserStatus } from '@prisma/client';

import { AuthService } from '../auth/auth.service';
import { AuditService } from '../common/audit/audit.service';
import type { RequestContextData } from '../common/decorators/request-context.decorator';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import type {
  PreferencesDto,
  ProfileDto,
  RgLimitsDto,
  SelfExcludeDto,
  SelfExclusionDto,
  SessionDto,
  SetRgLimitsDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto/users.dto';

/**
 * Self-service account management.
 *
 * The responsible-gaming operations here are the ones with real consequences:
 * limits constrain the game engine, and self-exclusion is a one-way door that
 * immediately locks the account. Both are audited without exception.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authService: AuthService,
  ) {}

  // ───────────────────────────── Profile ─────────────────────────────

  async getProfile(userId: string): Promise<ProfileDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        mobile: true,
        displayName: true,
        avatarUrl: true,
        locale: true,
        timezone: true,
        theme: true,
        status: true,
        emailVerifiedAt: true,
        mobileVerifiedAt: true,
        createdAt: true,
        roles: { select: { role: { select: { code: true } } } },
      },
    });

    if (!user) {
      throw new NotFoundDomainException('User', userId);
    }

    return {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      timezone: user.timezone,
      theme: user.theme,
      status: user.status,
      emailVerified: user.emailVerifiedAt !== null,
      mobileVerified: user.mobileVerifiedAt !== null,
      roles: user.roles.map((assignment) => assignment.role.code),
      createdAt: user.createdAt.toISOString(),
    };
  }

  /** Updates mutable profile fields. Identifiers (email, mobile) are not editable here. */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    ctx: RequestContextData,
  ): Promise<ProfileDto> {
    const data: Prisma.UserUpdateInput = {};

    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.locale !== undefined) data.locale = dto.locale;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.theme !== undefined) data.theme = dto.theme;

    await this.prisma.user.update({ where: { id: userId }, data });

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: userId,
      action: 'user.profile_updated',
      targetType: 'user',
      targetId: userId,
      payload: { fields: Object.keys(data) },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    return this.getProfile(userId);
  }

  // ───────────────────────────── Sessions ─────────────────────────────

  /** Live sessions, newest first, with the calling session flagged. */
  async listSessions(userId: string, currentSessionId: string): Promise<SessionDto[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        deviceFingerprint: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      ip: session.ip,
      userAgent: session.userAgent,
      deviceFingerprint: session.deviceFingerprint,
      current: session.id === currentSessionId,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    }));
  }

  /** Revokes one of the caller's own sessions. */
  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId: string,
    ctx: RequestContextData,
  ): Promise<{ message: string }> {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, revokedAt: true },
    });

    if (!session) {
      // Scoped to the caller, so a foreign id is indistinguishable from a missing one.
      throw new NotFoundDomainException('Session', sessionId);
    }

    if (session.revokedAt !== null) {
      return { message: 'That session was already signed out.' };
    }

    return this.authService.logout(userId, sessionId, ctx).then(() => ({
      message:
        sessionId === currentSessionId
          ? 'Signed out of the current session.'
          : 'That session has been signed out.',
    }));
  }

  // ───────────────────────────── Preferences ─────────────────────────────

  async getPreferences(userId: string): Promise<PreferencesDto> {
    const preference = await this.prisma.userPreference.findUnique({
      where: { userId },
      select: {
        locale: true,
        theme: true,
        chartWindow: true,
        notifyEmail: true,
        notifyPush: true,
        notifyInApp: true,
      },
    });

    if (!preference) {
      throw new NotFoundDomainException('Preferences for user', userId);
    }

    return preference;
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
    ctx: RequestContextData,
  ): Promise<PreferencesDto> {
    const data: Prisma.UserPreferenceUpdateInput = {};

    if (dto.locale !== undefined) data.locale = dto.locale;
    if (dto.theme !== undefined) data.theme = dto.theme;
    if (dto.chartWindow !== undefined) data.chartWindow = dto.chartWindow;
    if (dto.notifyEmail !== undefined) data.notifyEmail = dto.notifyEmail;
    if (dto.notifyPush !== undefined) data.notifyPush = dto.notifyPush;
    if (dto.notifyInApp !== undefined) data.notifyInApp = dto.notifyInApp;

    await this.prisma.userPreference.update({ where: { userId }, data });

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: userId,
      action: 'user.preferences_updated',
      targetType: 'user_preference',
      targetId: userId,
      payload: { fields: Object.keys(data) },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    return this.getPreferences(userId);
  }

  // ───────────────────────── Responsible gaming ─────────────────────────

  /** Current limits, or an all-null record when none are set. */
  async getRgLimits(userId: string): Promise<RgLimitsDto> {
    const limit = await this.prisma.responsibleGamingLimit.findUnique({
      where: { userId },
      select: {
        dailyBetLimit: true,
        dailyLossLimit: true,
        sessionTimeLimit: true,
        enabledAt: true,
      },
    });

    return {
      dailyBetLimit: limit?.dailyBetLimit?.toString() ?? null,
      dailyLossLimit: limit?.dailyLossLimit?.toString() ?? null,
      sessionTimeLimit: limit?.sessionTimeLimit ?? null,
      enabledAt: limit?.enabledAt?.toISOString() ?? null,
    };
  }

  /**
   * Sets or clears responsible-gaming limits.
   *
   * Tightening a limit takes effect immediately. Loosening or removing one is
   * accepted here but should be gated by a cool-off in the product layer — the
   * audit entry records the direction of every change so that policy can be
   * enforced and evidenced.
   */
  async setRgLimits(
    userId: string,
    dto: SetRgLimitsDto,
    ctx: RequestContextData,
  ): Promise<RgLimitsDto> {
    const previous = await this.getRgLimits(userId);

    const dailyBetLimit =
      dto.dailyBetLimit === undefined ? undefined : dto.dailyBetLimit === null ? null : BigInt(dto.dailyBetLimit);
    const dailyLossLimit =
      dto.dailyLossLimit === undefined
        ? undefined
        : dto.dailyLossLimit === null
          ? null
          : BigInt(dto.dailyLossLimit);

    if (dailyBetLimit !== undefined && dailyBetLimit !== null && dailyBetLimit === 0n) {
      throw new ValidationDomainException(
        'A daily bet limit of zero would block all play. Use self-exclusion instead.',
        'INVALID_RG_LIMIT',
      );
    }

    await this.prisma.responsibleGamingLimit.upsert({
      where: { userId },
      create: {
        userId,
        dailyBetLimit: dailyBetLimit ?? null,
        dailyLossLimit: dailyLossLimit ?? null,
        sessionTimeLimit: dto.sessionTimeLimit ?? null,
        enabledAt: new Date(),
      },
      update: {
        ...(dailyBetLimit !== undefined ? { dailyBetLimit } : {}),
        ...(dailyLossLimit !== undefined ? { dailyLossLimit } : {}),
        ...(dto.sessionTimeLimit !== undefined ? { sessionTimeLimit: dto.sessionTimeLimit } : {}),
        enabledAt: new Date(),
      },
    });

    const updated = await this.getRgLimits(userId);

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: userId,
      action: 'user.rg_limits_set',
      targetType: 'responsible_gaming_limit',
      targetId: userId,
      payload: { previous, updated },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    return updated;
  }

  /**
   * Self-excludes the account.
   *
   * This is intentionally irreversible from the user's side: the account status
   * flips to `SELF_EXCLUDED`, every session is revoked immediately, and login is
   * refused until the period ends. An active exclusion may only be extended,
   * never shortened.
   */
  async selfExclude(
    userId: string,
    dto: SelfExcludeDto,
    ctx: RequestContextData,
  ): Promise<SelfExclusionDto> {
    const now = new Date();

    const active = await this.prisma.selfExclusionRecord.findFirst({
      where: { userId, endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
      select: { id: true, endsAt: true },
    });

    const endsAt = new Date(now.getTime() + dto.durationDays * 24 * 60 * 60 * 1000);

    if (active && active.endsAt.getTime() >= endsAt.getTime()) {
      throw new ConflictDomainException(
        `An active self-exclusion already runs until ${active.endsAt.toISOString()}. It cannot be shortened.`,
        'SELF_EXCLUSION_ACTIVE',
      );
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.selfExclusionRecord.create({
        data: {
          userId,
          startsAt: now,
          endsAt,
          reason: dto.reason ?? null,
        },
        select: { id: true, startsAt: true, endsAt: true, reason: true },
      });

      await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.SELF_EXCLUDED },
      });

      await this.audit.recordTx(tx, {
        actorType: ActorType.USER,
        actorId: userId,
        action: 'user.self_excluded',
        targetType: 'user',
        targetId: userId,
        payload: {
          durationDays: dto.durationDays,
          startsAt: now.toISOString(),
          endsAt: endsAt.toISOString(),
          extendedFrom: active?.endsAt.toISOString() ?? null,
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        correlationId: ctx.correlationId,
      });

      return created;
    });

    // Cut off access now, not at token expiry.
    const sessionsRevoked = await this.authService.revokeAllSessions(userId);

    this.logger.log(
      `User ${userId} self-excluded until ${endsAt.toISOString()}; ${sessionsRevoked} session(s) revoked.`,
    );

    return {
      id: record.id,
      startsAt: record.startsAt.toISOString(),
      endsAt: record.endsAt.toISOString(),
      reason: record.reason,
      sessionsRevoked,
    };
  }

  /**
   * True when the account currently has an active self-exclusion.
   * Consulted by the game engine before accepting a stake.
   */
  async isSelfExcluded(userId: string): Promise<boolean> {
    const record = await this.prisma.selfExclusionRecord.findFirst({
      where: { userId, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
      select: { id: true },
    });

    return record !== null;
  }
}
