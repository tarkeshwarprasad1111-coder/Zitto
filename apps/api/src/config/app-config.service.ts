import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env.validation';

/**
 * Typed accessor over the validated environment.
 *
 * Services should depend on this rather than `ConfigService` directly so that
 * every consumer gets the coerced types (BigInt coin amounts, numbers, booleans)
 * instead of raw strings.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true }) as Env[K];
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get port(): number {
    return this.get('API_PORT');
  }

  get apiUrl(): string {
    return this.get('API_URL');
  }

  get swaggerEnabled(): boolean {
    return this.get('SWAGGER_ENABLED') && !this.isProduction;
  }

  get corsOrigins(): string[] {
    return this.get('CORS_ORIGIN')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.get('LOG_LEVEL');
  }

  get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }

  get redisUrl(): string {
    return this.get('REDIS_URL');
  }

  get jwt() {
    return {
      accessSecret: this.get('JWT_ACCESS_SECRET'),
      refreshSecret: this.get('JWT_REFRESH_SECRET'),
      accessTtl: this.get('JWT_ACCESS_TTL'),
      refreshTtl: this.get('JWT_REFRESH_TTL'),
      issuer: this.get('JWT_ISSUER'),
      audience: this.get('JWT_AUDIENCE'),
    } as const;
  }

  /**
   * Key used to sign settled rounds. A dedicated secret is strongly preferred —
   * reusing the auth secret means a fairness-verification leak would also be an
   * authentication leak.
   */
  get fairnessSigningSecret(): string {
    return this.get('FAIRNESS_SIGNING_SECRET') ?? this.get('JWT_ACCESS_SECRET');
  }

  get hasDedicatedFairnessSecret(): boolean {
    return this.get('FAIRNESS_SIGNING_SECRET') !== undefined;
  }

  get argon2() {
    return {
      memoryCost: this.get('ARGON2_MEMORY_COST'),
      timeCost: this.get('ARGON2_TIME_COST'),
      parallelism: this.get('ARGON2_PARALLELISM'),
    } as const;
  }

  get otp() {
    return {
      provider: this.get('OTP_PROVIDER'),
      ttlSeconds: this.get('OTP_TTL_SECONDS'),
      maxAttempts: this.get('OTP_MAX_ATTEMPTS'),
      resendCooldownSeconds: this.get('OTP_RESEND_COOLDOWN_SECONDS'),
    } as const;
  }

  get economy() {
    return {
      signupBonus: this.get('SIGNUP_BONUS_COINS'),
      dailyReward: this.get('DAILY_REWARD_COINS'),
      minBet: this.get('MIN_BET'),
      maxBet: this.get('MAX_BET'),
    } as const;
  }

  get roundTimings() {
    return {
      bettingMs: this.get('GAME_ROUND_BETTING_MS'),
      drawingMs: this.get('GAME_ROUND_DRAWING_MS'),
      resultMs: this.get('GAME_ROUND_RESULT_MS'),
    } as const;
  }

  get analytics() {
    return {
      defaultWindow: this.get('DEFAULT_ANALYTICS_WINDOW'),
      maxWindow: this.get('MAX_ANALYTICS_WINDOW'),
      defaultModelCode: this.get('DEFAULT_PREDICTION_MODEL'),
    } as const;
  }

  get idempotencyTtlSeconds(): number {
    return this.get('IDEMPOTENCY_TTL_SECONDS');
  }

  get throttle() {
    return {
      ttlSeconds: this.get('THROTTLE_TTL_SECONDS'),
      limit: this.get('THROTTLE_LIMIT'),
      authLimit: this.get('THROTTLE_AUTH_LIMIT'),
    } as const;
  }

  get featureFlagDefaults() {
    return {
      real_money: this.get('FEATURE_REAL_MONEY'),
      live_dealer: this.get('FEATURE_LIVE_DEALER'),
      spin_wheel: this.get('FEATURE_SPIN_WHEEL'),
    } as const;
  }
}
