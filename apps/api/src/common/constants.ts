/**
 * Cross-cutting constants and the single place where this application couples to
 * physical database naming.
 *
 * `prisma/schema.prisma` is owned by another workstream. Everything in this file
 * is an assumption about that schema; if a name drifts, fix it here rather than
 * hunting through services.
 */

/** Physical table names used by the raw `SELECT ... FOR UPDATE` in WalletService. */
export const TABLE = {
  VIRTUAL_WALLETS: 'virtual_wallets',
  WALLET_LEDGER: 'wallet_ledger',
  GAME_ROUNDS: 'game_rounds',
} as const;

/** Request-scoped header names. */
export const HEADER = {
  REQUEST_ID: 'x-request-id',
  IDEMPOTENCY_KEY: 'idempotency-key',
  DEVICE_ID: 'x-device-id',
} as const;

/** Reflector metadata keys. */
export const META = {
  IS_PUBLIC: 'zitto:is_public',
  ROLES: 'zitto:roles',
  IDEMPOTENT: 'zitto:idempotent',
  AUDIT_ACTION: 'zitto:audit_action',
} as const;

/** Redis key namespaces. Keep prefixes short — they are hot-path keys. */
export const REDIS_KEY = {
  idempotency: (scope: string, key: string) => `idem:${scope}:${key}`,
  otpCooldown: (channel: string, target: string) => `otp:cd:${channel}:${target}`,
  dailyReward: (userId: string, day: string) => `reward:daily:${userId}:${day}`,
  walletLock: (userId: string) => `lock:wallet:${userId}`,
  analyticsSummary: (window: number, roomId: string) => `analytics:sum:${roomId}:${window}`,
  sessionRevoked: (sessionId: string) => `session:revoked:${sessionId}`,
} as const;

/** Role codes seeded by `prisma/seed.ts`. */
export const ROLE = {
  GUEST: 'guest',
  PLAYER: 'player',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export type RoleCode = (typeof ROLE)[keyof typeof ROLE];

/** `WalletLedger.sourceType` discriminators. */
export const LEDGER_SOURCE = {
  ROUND: 'round',
  MISSION: 'mission',
  ACHIEVEMENT: 'achievement',
  PROMO_CODE: 'promo_code',
  DAILY_REWARD: 'daily_reward',
  SIGNUP: 'signup',
  REFERRAL: 'referral',
  TOURNAMENT: 'tournament',
  ADMIN: 'admin',
} as const;

/** `AppSetting.key` values seeded for game configuration. */
export const SETTING_KEY = {
  GAME_MIN_BET: 'game.min_bet',
  GAME_MAX_BET: 'game.max_bet',
  GAME_PAYOUT_DRAGON: 'game.payout.dragon',
  GAME_PAYOUT_TIGER: 'game.payout.tiger',
  GAME_PAYOUT_TIE: 'game.payout.tie',
  GAME_BETTING_MS: 'game.timer.betting_ms',
  GAME_DRAWING_MS: 'game.timer.drawing_ms',
  GAME_RESULT_MS: 'game.timer.result_ms',
  GAME_MAINTENANCE: 'game.maintenance',
  SIGNUP_BONUS: 'wallet.signup_bonus',
  DAILY_REWARD: 'wallet.daily_reward',
} as const;

/**
 * Mandatory legal text on every analytics and prediction payload.
 * Do not reword without product + compliance sign-off.
 */
export const ANALYTICS_DISCLAIMER =
  'Every round is independent. Historical patterns do not determine future outcomes.';

/** Confidence labels. The model may never emit anything stronger than "Moderate signal". */
export const CONFIDENCE_LABEL = {
  NONE: 'No reliable signal',
  LOW: 'Low confidence',
  MODERATE: 'Moderate signal',
} as const;

export type ConfidenceLabel = (typeof CONFIDENCE_LABEL)[keyof typeof CONFIDENCE_LABEL];

/** Sample-size thresholds that map to the labels above. */
export const CONFIDENCE_THRESHOLD = {
  LOW: 30,
  MODERATE: 100,
} as const;

/** Pagination bounds shared by every cursor-paginated list endpoint. */
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/** Analytics method identifier returned to clients for transparency. */
export const ANALYTICS_METHOD = 'rolling_frequency';
