import { z } from 'zod';

/**
 * Environment contract for the Zitto API.
 *
 * Every value the application depends on is declared here and validated once at
 * boot. A misconfigured deployment fails fast with a readable message instead of
 * surfacing as a runtime `undefined` deep inside a money path.
 */

const bool = (defaultValue: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .default(defaultValue ? 'true' : 'false')
    .transform((v) => v === 'true' || v === '1');

const int = (defaultValue: number, min = 0) =>
  z.coerce.number().int().min(min).default(defaultValue);

const bigIntCoins = (defaultValue: string) =>
  z
    .string()
    .default(defaultValue)
    .refine((v) => /^\d+$/.test(v), { message: 'must be a non-negative integer' })
    .transform((v) => BigInt(v));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Infrastructure
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // HTTP
  API_PORT: int(4000, 1),
  API_URL: z.string().default('http://localhost:4000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SWAGGER_ENABLED: bool(true),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be >= 32 chars'),
  JWT_ACCESS_TTL: int(300, 30),
  JWT_REFRESH_TTL: int(2_592_000, 60),
  JWT_ISSUER: z.string().default('zitto-api'),
  JWT_AUDIENCE: z.string().default('zitto-clients'),
  ARGON2_MEMORY_COST: int(19_456, 8192),
  ARGON2_TIME_COST: int(2, 1),
  ARGON2_PARALLELISM: int(1, 1),

  /**
   * Key for the provable-fairness HMAC over settled rounds. Should be a dedicated
   * secret; falls back to the access-token secret with a warning if unset.
   */
  FAIRNESS_SIGNING_SECRET: z.string().min(32).optional(),

  // OTP
  OTP_PROVIDER: z.enum(['console', 'noop']).default('console'),
  OTP_TTL_SECONDS: int(300, 30),
  OTP_MAX_ATTEMPTS: int(5, 1),
  OTP_RESEND_COOLDOWN_SECONDS: int(60, 0),

  // Wallet / economy (coins are always integers — BigInt end to end)
  SIGNUP_BONUS_COINS: bigIntCoins('500'),
  DAILY_REWARD_COINS: bigIntCoins('100'),
  MIN_BET: bigIntCoins('10'),
  MAX_BET: bigIntCoins('10000'),

  // Game round timings (ms)
  GAME_ROUND_BETTING_MS: int(20_000, 1000),
  GAME_ROUND_DRAWING_MS: int(6_000, 500),
  GAME_ROUND_RESULT_MS: int(4_000, 500),

  // Analytics / prediction
  DEFAULT_ANALYTICS_WINDOW: int(50, 1),
  MAX_ANALYTICS_WINDOW: int(1000, 1),
  DEFAULT_PREDICTION_MODEL: z.string().default('freq_rolling_50'),

  // Idempotency
  IDEMPOTENCY_TTL_SECONDS: int(86_400, 60),

  // Rate limiting
  THROTTLE_TTL_SECONDS: int(60, 1),
  THROTTLE_LIMIT: int(100, 1),
  THROTTLE_AUTH_LIMIT: int(10, 1),

  // Feature flags (boot defaults; runtime source of truth is the FeatureFlag table)
  FEATURE_REAL_MONEY: bool(false),
  FEATURE_LIVE_DEALER: bool(false),
  FEATURE_SPIN_WHEEL: bool(false),

  // Seed
  SEED_ADMIN_EMAIL: z.string().email().default('admin@zitto.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('ChangeMe123!'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Used as ConfigModule `validate`. Throws a single aggregated error listing every
 * invalid key so operators do not have to fix env vars one boot at a time.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return parsed.data;
}
