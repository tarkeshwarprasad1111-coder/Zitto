/**
 * Shared types for the Zitto admin console.
 *
 * These mirror the REST v1 contracts served by `@zitto/api`. Wire formats use
 * lower_snake enum values; the console never invents its own.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export type ISODateString = string;

/**
 * Virtual coin amount. Coins are integers with no cash value.
 *
 * The API serialises balances as decimal strings because they can exceed
 * `Number.MAX_SAFE_INTEGER` across the whole economy, so every coin field is
 * widened to accept a string and must be formatted with `formatCoins`.
 */
export type Coins = number | bigint | string;

export type Locale = 'en' | 'hi';

export type Outcome = 'DRAGON' | 'TIGER' | 'TIE';

export type GameMode = 'CLASSIC' | 'QUICK' | 'PRACTICE' | 'PRIVATE' | 'PUBLIC' | 'TOURNAMENT';

/* ------------------------------------------------------------------ */
/* Admin identity                                                      */
/* ------------------------------------------------------------------ */

export type AdminRole = 'moderator' | 'admin' | 'super_admin';

/** Every role recognised by the platform, including player-side ones. */
export type UserRole = 'guest' | 'player' | AdminRole;

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  roles: AdminRole[];
  /** Fine-grained permission codes, e.g. `rounds.void`. */
  permissions: string[];
  twoFactorEnabled: boolean;
  lastLoginAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until `accessToken` expires. */
  expiresIn: number;
}

export interface AdminLoginResponse {
  admin: AdminUser;
  tokens: AuthTokens;
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  /** Round-trip latency in milliseconds, when the probe reports one. */
  latencyMs: number | null;
  detail: string | null;
  checkedAt: ISODateString;
}

export interface TrendPoint {
  /** Bucket start, ISO 8601. */
  timestamp: ISODateString;
  /** Human label for the axis, e.g. `14:00`. */
  label: string;
  value: number;
}

export interface OutcomeDistribution {
  dragon: number;
  tiger: number;
  tie: number;
}

export interface DashboardStats {
  totalUsers: number;
  activeToday: number;
  newRegistrations7d: number;
  roundsPlayedToday: number;
  coinsInCirculation: Coins;
  openTickets: number;
  fraudAlerts: number;
  /** Percent change vs. the previous comparable period, as a 0–1 ratio. */
  deltas: {
    totalUsers: number | null;
    activeToday: number | null;
    newRegistrations7d: number | null;
    roundsPlayedToday: number | null;
    coinsInCirculation: number | null;
    openTickets: number | null;
    fraudAlerts: number | null;
  };
  roundsPerHour: TrendPoint[];
  outcomeDistribution: OutcomeDistribution;
  systemHealth: ServiceHealth[];
  recentAudit: AuditLogEntry[];
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export type UserStatus = 'active' | 'suspended' | 'self_excluded' | 'deleted';

export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected';

export interface ManagedUser {
  id: string;
  displayName: string;
  email: string | null;
  mobile: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  roles: UserRole[];
  locale: Locale;
  balance: Coins;
  emailVerifiedAt: ISODateString | null;
  mobileVerifiedAt: ISODateString | null;
  kycStatus: KycStatus;
  createdAt: ISODateString;
  lastActiveAt: ISODateString | null;
  /** Set while `status === 'suspended'`. */
  suspendedReason: string | null;
  suspendedUntil: ISODateString | null;
  flagCount: number;
}

export interface ResponsibleGamingLimits {
  dailyLossLimit: Coins | null;
  sessionTimeLimitMinutes: number | null;
  dailyRoundLimit: number | null;
  enabledAt: ISODateString | null;
}

export interface SelfExclusion {
  active: boolean;
  startedAt: ISODateString | null;
  endsAt: ISODateString | null;
  /** `null` means permanent. */
  durationDays: number | null;
}

export interface UserSession {
  id: string;
  deviceLabel: string;
  ipAddress: string;
  userAgent: string;
  location: string | null;
  createdAt: ISODateString;
  lastSeenAt: ISODateString;
  current: boolean;
}

export interface UserNote {
  id: string;
  userId: string;
  authorName: string;
  authorId: string;
  body: string;
  createdAt: ISODateString;
}

export interface UserDetail extends ManagedUser {
  wallet: {
    balance: Coins;
    locked: Coins;
    bonus: Coins;
    lifetimeWagered: Coins;
    lifetimeWon: Coins;
    updatedAt: ISODateString;
  };
  responsibleGaming: ResponsibleGamingLimits;
  selfExclusion: SelfExclusion;
  stats: {
    roundsPlayed: number;
    winRate: number;
    biggestWin: Coins;
    referrals: number;
  };
}

/* ------------------------------------------------------------------ */
/* Game rounds & fairness                                              */
/* ------------------------------------------------------------------ */

export type RoundState = 'BETTING' | 'DRAWING' | 'SETTLED' | 'VOIDED';

export interface PlayingCardData {
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: number;
}

export interface GameRoundSummary {
  id: string;
  roundNumber: number;
  roomId: string;
  roomName: string;
  mode: GameMode;
  state: RoundState;
  outcome: Outcome | null;
  betsCount: number;
  playersCount: number;
  coinsWagered: Coins;
  coinsPaidOut: Coins;
  startedAt: ISODateString;
  settledAt: ISODateString | null;
  /** Populated only when the round was voided. */
  voidReason: string | null;
}

/**
 * Provably-fair commitment for a round.
 *
 * `serverSeed` stays `null` until the round settles — publishing it earlier
 * would let a player derive the cards before the draw.
 */
export interface FairnessProof {
  algorithm: string;
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  /** Hex digest the cards were derived from. */
  combinedHash: string | null;
  derivedCards: {
    dragon: PlayingCardData;
    tiger: PlayingCardData;
  } | null;
  /** Detached signature over the settled result. */
  signature: string | null;
  signaturePublicKeyId: string | null;
  verifiedAt: ISODateString | null;
}

export interface RoundBet {
  id: string;
  userId: string;
  displayName: string;
  selection: Outcome;
  amount: Coins;
  payout: Coins;
  status: 'PLACED' | 'WON' | 'LOST' | 'REFUNDED' | 'VOIDED';
  placedAt: ISODateString;
}

export interface GameRoundDetail extends GameRoundSummary {
  fairness: FairnessProof;
  bets: RoundBet[];
  phaseTimings: {
    bettingMs: number;
    drawingMs: number;
    resultMs: number;
  };
  /** Appended corrections. The original round record is never mutated. */
  corrections: RoundCorrection[];
}

export interface RoundCorrection {
  id: string;
  roundId: string;
  actorName: string;
  actorId: string;
  reason: string;
  /** Net coins moved by the correction across all affected wallets. */
  netAdjustment: Coins;
  affectedUserCount: number;
  createdAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* Game configuration                                                  */
/* ------------------------------------------------------------------ */

export interface GameModeConfig {
  mode: GameMode;
  label: string;
  enabled: boolean;
}

export interface GameConfig {
  modes: GameModeConfig[];
  phases: {
    bettingMs: number;
    drawingMs: number;
    resultMs: number;
  };
  payouts: {
    dragon: number;
    tiger: number;
    tie: number;
    /** Fraction of a Dragon/Tiger stake returned when the round ties. */
    tieRefundRatio: number;
  };
  limits: {
    minBet: number;
    maxBet: number;
    maxBetsPerRound: number;
  };
  maintenance: {
    enabled: boolean;
    message: string;
  };
  updatedAt: ISODateString;
  updatedBy: string | null;
}

/* ------------------------------------------------------------------ */
/* Wallet ledger                                                       */
/* ------------------------------------------------------------------ */

export type LedgerEntryType =
  | 'bet'
  | 'win'
  | 'refund'
  | 'signup_bonus'
  | 'daily_reward'
  | 'mission'
  | 'achievement'
  | 'referral'
  | 'promo'
  | 'admin_credit'
  | 'admin_debit'
  | 'tournament_entry'
  | 'tournament_prize'
  | 'correction';

export type LedgerActorType = 'system' | 'user' | 'admin' | 'game_engine';

export interface LedgerEntry {
  id: string;
  userId: string;
  displayName: string;
  type: LedgerEntryType;
  amount: Coins;
  balanceBefore: Coins;
  balanceAfter: Coins;
  sourceType:
    | 'round'
    | 'mission'
    | 'achievement'
    | 'promo_code'
    | 'daily_reward'
    | 'signup'
    | 'referral'
    | 'tournament'
    | 'admin'
    | null;
  sourceId: string | null;
  actorType: LedgerActorType;
  actorId: string | null;
  description: string;
  createdAt: ISODateString;
}

export interface ReconciliationStatus {
  /** Sum of every ledger delta. */
  ledgerTotal: Coins;
  /** Sum of every wallet balance. */
  walletTotal: Coins;
  /** `walletTotal - ledgerTotal`. Zero when the books agree. */
  difference: Coins;
  balanced: boolean;
  mismatchedWallets: number;
  checkedAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export interface AuditLogEntry {
  id: string;
  actorType: LedgerActorType;
  actorId: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  /** Free-text justification captured at the time of the action. */
  reason: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* Tournaments                                                         */
/* ------------------------------------------------------------------ */

export type TournamentState = 'DRAFT' | 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED';

export interface PrizeTier {
  /** Inclusive rank range, e.g. ranks 1–1 or 4–10. */
  fromRank: number;
  toRank: number;
  prize: Coins;
}

export interface TournamentSummary {
  id: string;
  name: string;
  mode: GameMode;
  state: TournamentState;
  startsAt: ISODateString;
  endsAt: ISODateString;
  entryFee: Coins;
  prizePool: Coins;
  prizeTiers: PrizeTier[];
  participants: number;
  maxParticipants: number | null;
  rules: string;
  createdAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* Rewards                                                             */
/* ------------------------------------------------------------------ */

export interface DailyRewardTier {
  id: string;
  day: number;
  coins: Coins;
  /** Extra multiplier applied on an unbroken streak. */
  streakBonus: number;
  enabled: boolean;
}

export type MissionType = 'DAILY' | 'WEEKLY' | 'ONETIME';

export interface MissionConfig {
  id: string;
  code: string;
  title: string;
  description: string;
  type: MissionType;
  /** Event the counter listens to, e.g. `round.settled`. */
  triggerEvent: string;
  targetCount: number;
  rewardCoins: Coins;
  enabled: boolean;
  startsAt: ISODateString | null;
  endsAt: ISODateString | null;
  updatedAt: ISODateString;
}

export interface AchievementConfig {
  id: string;
  code: string;
  title: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  targetCount: number;
  rewardCoins: Coins;
  enabled: boolean;
  unlockedCount: number;
}

export interface PromoCode {
  id: string;
  code: string;
  description: string;
  rewardCoins: Coins;
  maxRedemptions: number | null;
  redemptions: number;
  perUserLimit: number;
  startsAt: ISODateString;
  expiresAt: ISODateString | null;
  enabled: boolean;
  createdAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* Prediction models                                                   */
/* ------------------------------------------------------------------ */

export interface PredictionModelConfig {
  id: string;
  code: string;
  name: string;
  description: string;
  method: string;
  enabled: boolean;
  /** Minimum rounds observed before the model is allowed to publish output. */
  minDataRounds: number;
  /** Measured accuracy as a 0–1 ratio over `sampleSize` scored predictions. */
  accuracy: number | null;
  /** Below this ratio the model is auto-disabled by the platform. */
  accuracyFloor: number;
  sampleSize: number;
  /** True when the platform disabled the model for under-performing. */
  autoDisabled: boolean;
  autoDisabledAt: ISODateString | null;
  autoDisabledReason: string | null;
  lastUpdatedAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* CMS                                                                 */
/* ------------------------------------------------------------------ */

export interface CmsPageSummary {
  id: string;
  slug: string;
  locale: Locale;
  title: string;
  /** Markdown source. Absent from list responses. */
  body?: string;
  published: boolean;
  version: number;
  updatedAt: ISODateString;
  updatedBy: string | null;
}

export interface BannerConfig {
  id: string;
  title: string;
  body: string;
  locale: Locale;
  placement: 'home' | 'lobby' | 'wallet' | 'global';
  ctaLabel: string | null;
  ctaHref: string | null;
  startsAt: ISODateString;
  endsAt: ISODateString | null;
  enabled: boolean;
}

/* ------------------------------------------------------------------ */
/* Feature flags                                                       */
/* ------------------------------------------------------------------ */

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  /** 0–100. Applies only while `enabled` is true. */
  rolloutPercent: number;
  /**
   * Flags gated behind legal review and compliance sign-off. The console must
   * surface the requirement and force a typed confirmation before enabling.
   */
  requiresComplianceSignOff: boolean;
  category: 'game' | 'economy' | 'social' | 'compliance' | 'experimental';
  updatedAt: ISODateString;
  updatedBy: string | null;
}

/* ------------------------------------------------------------------ */
/* Support & reports                                                   */
/* ------------------------------------------------------------------ */

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TicketMessage {
  id: string;
  authorName: string;
  authorType: 'user' | 'admin';
  body: string;
  createdAt: ISODateString;
}

export interface SupportTicket {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  userId: string;
  userDisplayName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  messages: TicketMessage[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
  firstResponseAt: ISODateString | null;
}

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  reason: string;
  details: string;
  status: ReportStatus;
  /** Populated once an admin closes the report. */
  resolution: string | null;
  reviewedBy: string | null;
  reviewedAt: ISODateString | null;
  createdAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/** RFC 7807 problem document. */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  correlationId?: string;
  /** Field-level validation errors, keyed by form field name. */
  errors?: Record<string, string[]>;
}

/** Cursor-paginated list envelope used by every admin list endpoint. */
export interface PaginatedResponse<T> {
  items: T[];
  /** Opaque cursor for the next page, or `null` at the end. */
  nextCursor: string | null;
  /** Opaque cursor for the previous page, or `null` on the first page. */
  prevCursor: string | null;
  hasMore: boolean;
  /** Server-side total when cheap to compute, otherwise `null`. */
  totalCount: number | null;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/**
 * Independence notice shown verbatim on every predictive surface, in the
 * console as well as the player app. Do not paraphrase or shorten.
 */
export const INDEPENDENCE_DISCLAIMER =
  'Every round is independent. Historical patterns do not determine future outcomes.';

/**
 * Model performance is published to players. It exists so they can judge the
 * analytics for themselves, which only works if it is never suppressed.
 */
export const MODEL_TRANSPARENCY_NOTICE =
  'Accuracy and sample size for every model are published to players in the app. These figures cannot be hidden, edited, or delayed from this console.';

/** Shown on every settled-round surface. */
export const IMMUTABLE_HISTORY_NOTICE =
  'Settled results are immutable. Corrections are appended as new records and the original round is never edited.';
