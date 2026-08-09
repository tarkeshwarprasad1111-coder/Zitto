import { Inject, Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';

import { REDIS_KEY } from '../common/constants';
import {
  RateLimitDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { Channel } from './dto/auth.dto';

/** Injection token for the pluggable delivery adapter. */
export const OTP_PROVIDER = Symbol('OTP_PROVIDER');

/**
 * Delivery adapter. Swap the implementation to plug in SES, Twilio, MSG91, etc.
 * without touching a line of OTP logic.
 */
export interface OtpProvider {
  readonly name: string;
  send(params: {
    channel: Channel;
    target: string;
    code: string;
    ttlSeconds: number;
    purpose: OtpPurpose;
  }): Promise<void>;
}

export type OtpPurpose = 'verification' | 'password_reset';

export interface IssuedOtp {
  channel: Channel;
  /** Masked for safe display, e.g. `a***@example.com`. */
  maskedTarget: string;
  expiresIn: number;
}

/**
 * One-time code issuance and verification.
 *
 * Storage differs by purpose, deliberately:
 *  - `verification` codes are persisted as `VerificationRecord` rows. Account
 *    verification is a compliance-relevant event and needs a durable audit trail.
 *  - `password_reset` codes live only in Redis with a short TTL. They are
 *    transient credentials; there is no reason to keep them after use.
 *
 * Codes are hashed with Argon2id, never stored in the clear. A 6-digit code has
 * only ~20 bits of entropy, so the attempt cap (default 5) and the TTL are what
 * actually make it safe — the hash protects against database disclosure.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
    @Inject(OTP_PROVIDER) private readonly provider: OtpProvider,
  ) {}

  /**
   * Issues an account-verification code and persists a `VerificationRecord`.
   * Any earlier unconsumed code for the same target is invalidated first, so only
   * the newest code ever works.
   */
  async issueVerification(params: {
    userId: string;
    channel: Channel;
    target: string;
    ip?: string | null;
  }): Promise<IssuedOtp> {
    await this.enforceCooldown(params.channel, params.target);

    const { ttlSeconds } = this.config.otp;
    const code = this.generateCode();
    const codeHash = await this.hashCode(code);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.$transaction(async (tx) => {
      // Supersede outstanding codes: expire them rather than delete, keeping the trail.
      await tx.verificationRecord.updateMany({
        where: {
          userId: params.userId,
          channel: params.channel,
          target: params.target,
          verifiedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { expiresAt: new Date() },
      });

      await tx.verificationRecord.create({
        data: {
          userId: params.userId,
          channel: params.channel,
          target: params.target,
          codeHash,
          expiresAt,
          attempts: 0,
          ip: params.ip ?? null,
        },
      });
    });

    await this.deliver({
      channel: params.channel,
      target: params.target,
      code,
      ttlSeconds,
      purpose: 'verification',
    });

    await this.startCooldown(params.channel, params.target);

    return {
      channel: params.channel,
      maskedTarget: maskTarget(params.channel, params.target),
      expiresIn: ttlSeconds,
    };
  }

  /**
   * Verifies an account-verification code.
   *
   * @returns the id of the consumed record.
   * @throws {ValidationDomainException} on a wrong, expired, or exhausted code.
   */
  async verifyCode(params: {
    userId: string;
    channel: Channel;
    target: string;
    code: string;
  }): Promise<{ recordId: string }> {
    const record = await this.prisma.verificationRecord.findFirst({
      where: {
        userId: params.userId,
        channel: params.channel,
        target: params.target,
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new ValidationDomainException(
        'No pending verification code for this target. Request a new one.',
        'OTP_NOT_FOUND',
      );
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new ValidationDomainException(
        'This verification code has expired. Request a new one.',
        'OTP_EXPIRED',
      );
    }

    const { maxAttempts } = this.config.otp;

    if (record.attempts >= maxAttempts) {
      throw new RateLimitDomainException(
        `Too many incorrect attempts. Request a new verification code.`,
        'OTP_ATTEMPTS_EXCEEDED',
      );
    }

    const matches = await this.verifyHash(record.codeHash, params.code);

    if (!matches) {
      const updated = await this.prisma.verificationRecord.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });

      const remaining = Math.max(0, maxAttempts - updated.attempts);

      throw new ValidationDomainException(
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect code. No attempts remaining — request a new code.',
        'OTP_INVALID',
      );
    }

    await this.prisma.verificationRecord.update({
      where: { id: record.id },
      data: { verifiedAt: new Date(), attempts: { increment: 1 } },
    });

    await this.redis.del(REDIS_KEY.otpCooldown(params.channel, params.target));

    return { recordId: record.id };
  }

  /**
   * Issues a password-reset code. Redis-only, single-use, attempt-capped.
   * Callers must not reveal whether the account existed.
   */
  async issuePasswordReset(params: {
    userId: string;
    channel: Channel;
    target: string;
  }): Promise<IssuedOtp> {
    await this.enforceCooldown(params.channel, params.target);

    const { ttlSeconds } = this.config.otp;
    const code = this.generateCode();
    const codeHash = await this.hashCode(code);

    await this.redis.setJson(
      passwordResetKey(params.channel, params.target),
      { userId: params.userId, codeHash, attempts: 0 },
      ttlSeconds,
    );

    await this.deliver({
      channel: params.channel,
      target: params.target,
      code,
      ttlSeconds,
      purpose: 'password_reset',
    });

    await this.startCooldown(params.channel, params.target);

    return {
      channel: params.channel,
      maskedTarget: maskTarget(params.channel, params.target),
      expiresIn: ttlSeconds,
    };
  }

  /**
   * Validates and consumes a password-reset code.
   * @returns the user id the code was issued for.
   */
  async consumePasswordReset(params: {
    channel: Channel;
    target: string;
    code: string;
  }): Promise<{ userId: string }> {
    const key = passwordResetKey(params.channel, params.target);
    const record = await this.redis.getJson<{
      userId: string;
      codeHash: string;
      attempts: number;
    }>(key);

    if (!record) {
      throw new ValidationDomainException(
        'This reset code is invalid or has expired. Request a new one.',
        'RESET_CODE_INVALID',
      );
    }

    const { maxAttempts } = this.config.otp;

    if (record.attempts >= maxAttempts) {
      await this.redis.del(key);
      throw new RateLimitDomainException(
        'Too many incorrect attempts. Request a new reset code.',
        'RESET_ATTEMPTS_EXCEEDED',
      );
    }

    const matches = await this.verifyHash(record.codeHash, params.code);

    if (!matches) {
      const ttl = await this.redis.ttl(key);
      await this.redis.setJson(
        key,
        { ...record, attempts: record.attempts + 1 },
        ttl > 0 ? ttl : this.config.otp.ttlSeconds,
      );

      const remaining = Math.max(0, maxAttempts - (record.attempts + 1));
      throw new ValidationDomainException(
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect code. No attempts remaining — request a new code.',
        'RESET_CODE_INVALID',
      );
    }

    // Single use.
    await this.redis.del(key, REDIS_KEY.otpCooldown(params.channel, params.target));

    return { userId: record.userId };
  }

  /** Cryptographically uniform 6-digit code. `Math.random` is not acceptable here. */
  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private async hashCode(code: string): Promise<string> {
    const { memoryCost, timeCost, parallelism } = this.config.argon2;
    return argon2.hash(code, { type: argon2.argon2id, memoryCost, timeCost, parallelism });
  }

  private async verifyHash(hash: string, code: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, code);
    } catch {
      return false;
    }
  }

  private async enforceCooldown(channel: Channel, target: string): Promise<void> {
    const { resendCooldownSeconds } = this.config.otp;

    if (resendCooldownSeconds <= 0) {
      return;
    }

    const ttl = await this.redis.ttl(REDIS_KEY.otpCooldown(channel, target));

    if (ttl > 0) {
      throw new RateLimitDomainException(
        `Please wait ${ttl} second${ttl === 1 ? '' : 's'} before requesting another code.`,
        'OTP_COOLDOWN',
      );
    }
  }

  private async startCooldown(channel: Channel, target: string): Promise<void> {
    const { resendCooldownSeconds } = this.config.otp;
    if (resendCooldownSeconds > 0) {
      await this.redis.set(
        REDIS_KEY.otpCooldown(channel, target),
        '1',
        resendCooldownSeconds,
      );
    }
  }

  private async deliver(params: {
    channel: Channel;
    target: string;
    code: string;
    ttlSeconds: number;
    purpose: OtpPurpose;
  }): Promise<void> {
    try {
      await this.provider.send(params);
    } catch (error) {
      // The code is already stored; surfacing a provider outage as a 5xx would let
      // the client retry and burn the cooldown. Log loudly and let the user resend.
      this.logger.error(
        `OTP delivery failed via "${this.provider.name}" for ${maskTarget(params.channel, params.target)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function passwordResetKey(channel: Channel, target: string): string {
  return `pwreset:${channel}:${target.toLowerCase()}`;
}

/** `alice@example.com` → `a***e@example.com`; `+919876543210` → `+9198****3210`. */
export function maskTarget(channel: Channel, target: string): string {
  if (channel === 'email') {
    const [local = '', domain = ''] = target.split('@');
    if (local.length <= 2) {
      return `${local.charAt(0)}***@${domain}`;
    }
    return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`;
  }

  if (target.length <= 6) {
    return `****${target.slice(-2)}`;
  }

  return `${target.slice(0, 4)}****${target.slice(-4)}`;
}
