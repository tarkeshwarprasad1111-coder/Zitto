/**
 * Shared domain types for the Zitto web client.
 *
 * These mirror the API contract described in PLAN.md §4 (ER plan) and §5
 * (REST v1). Monetary values are **virtual coins expressed as integers** —
 * never floats, never real currency.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** ISO-8601 timestamp string, e.g. `2026-08-09T10:24:00.000Z`. */
export type ISODateString = string;

/** Virtual coin amount. Always an integer. Has no cash value. */
export type Coins = number;

export type Locale = 'en' | 'hi';

/* ------------------------------------------------------------------ */
/* User & account                                                      */
/* ------------------------------------------------------------------ */

export type UserStatus = 'active' | 'suspended' | 'self_excluded' | 'deleted';

export type UserRole = 'guest' | 'player' | 'moderator' | 'admin' | 'super_admin';

export interface User {
  id: string;
  email: string | null;
  mobile: string | null;
  displayName: string;
  avatarUrl: string | null;
  locale: Locale;
  timezone: string;
  status: UserStatus;
  roles: UserRole[];
  emailVerifiedAt: ISODateString | null;
  mobileVerifiedAt: ISODateString | null;
  ageConfirmedAt: ISODateString | null;
  twoFactorEnabled: boolean;
  createdAt: ISODateString;
}

export interface UserPreferences {
  locale: Locale;
  theme: 'dark' | 'light' | 'system';
  /** Default rolling window used on analytics screens. */
  defaultAnalyticsWindow: AnalyticsWindow;
  notifications: {
    roundResults: boolean;
    dailyReward: boolean;
    tournaments: boolean;
    marketing: boolean;
  };
  reducedMotion: boolean;
}

export interface ResponsibleGamingLimits {
  dailyLossLimit: Coins | null;
  sessionTimeLimitMinutes: number | null;
  enabledAt: ISODateString | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until `accessToken` expires. */
  expiresIn: number;
}

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
}

/* ------------------------------------------------------------------ */
/* Wallet                                                              */
/* ------------------------------------------------------------------ */

export interface Wallet {
  id: string;
  userId: string;
  /** Spendable coins. */
  balance: Coins;
  /** Coins reserved by an in-flight selection. */
  locked: Coins;
  /** Promotional coins. */
  bonus: Coins;
  updatedAt: ISODateString;
}

export type LedgerEntryType =
  | 'bet'
  | 'win'
  | 'refund'
  | 'daily_reward'
  | 'mission'
  | 'achievement'
  | 'referral'
  | 'promo'
  | 'admin_credit'
  | 'admin_debit'
  | 'tournament_prize'
  | 'correction';

export type LedgerActorType = 'system' | 'user' | 'admin' | 'game_engine';

export interface LedgerEntry {
  id: string;
  walletId: string;
  userId: string;
  type: LedgerEntryType;
  /** Signed: positive credits the wallet, negative debits it. */
  amount: Coins;
  balanceBefore: Coins;
  balanceAfter: Coins;
  sourceType: 'round' | 'mission' | 'achievement' | 'promo_code' | 'tournament' | 'admin' | null;
  sourceId: string | null;
  actorType: LedgerActorType;
  description: string;
  createdAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */

/** The three possible results of a Dragon Tiger round. */
export type Outcome = 'DRAGON' | 'TIGER' | 'TIE';

/** A player's chosen side for a round. Same domain as `Outcome`. */
export type BetSide = Outcome;

/** Lifecycle state of a round, as broadcast by the game engine. */
export type RoundState = 'WAITING' | 'BETTING' | 'DRAWING' | 'REVEALING' | 'SETTLED' | 'VOIDED';

export type GameMode = 'classic' | 'quick' | 'practice' | 'private' | 'public' | 'tournament';

export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

/** Card rank. In Dragon Tiger, Ace is LOW (value 1) and King is high (13). */
export type CardRank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';

export interface PlayingCardData {
  rank: CardRank;
  suit: CardSuit;
  /** Numeric comparison value: A=1 … K=13. */
  value: number;
}

export interface GameRoom {
  id: string;
  name: string;
  mode: GameMode;
  status: 'open' | 'full' | 'closed' | 'maintenance';
  playerCount: number;
  maxPlayers: number;
  minBet: Coins;
  maxBet: Coins;
  /** Full betting-phase duration in milliseconds. */
  bettingDurationMs: number;
  inviteCode: string | null;
}

export interface GameRound {
  id: string;
  roomId: string;
  roundNumber: number;
  state: RoundState;
  dragonCard: PlayingCardData | null;
  tigerCard: PlayingCardData | null;
  outcome: Outcome | null;
  bettingStartedAt: ISODateString | null;
  bettingEndsAt: ISODateString | null;
  settledAt: ISODateString | null;
  /** Published before the round; lets players verify fairness afterwards. */
  serverSeedHash: string;
  /** Revealed only after settlement. */
  serverSeed: string | null;
  clientSeed: string | null;
  nonce: number | null;
}

export type BetStatus = 'placed' | 'won' | 'lost' | 'refunded' | 'voided';

/** A player's confirmed selection on a round. */
export interface BetSelection {
  id: string;
  roundId: string;
  userId: string;
  side: BetSide;
  amount: Coins;
  status: BetStatus;
  /** Total returned to the wallet. `0` when the selection lost. */
  payout: Coins;
  placedAt: ISODateString;
  settledAt: ISODateString | null;
}

/** Payout multipliers. Tie pays 8:1; Dragon and Tiger pay 1:1. */
export interface PayoutTable {
  DRAGON: number;
  TIGER: number;
  TIE: number;
}

export interface GameConfig {
  modes: GameMode[];
  payouts: PayoutTable;
  minBet: Coins;
  maxBet: Coins;
  bettingDurationMs: number;
  drawingDurationMs: number;
  resultDurationMs: number;
}

export interface RoundResultSummary {
  roundId: string;
  roundNumber: number;
  outcome: Outcome;
  dragonCard: PlayingCardData;
  tigerCard: PlayingCardData;
  settledAt: ISODateString;
  /** The player's own selection on this round, when they had one. */
  yourSelection: BetSelection | null;
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

/** Number of most-recent rounds an analytics figure is computed over. */
export type AnalyticsWindow = 10 | 25 | 50 | 100;

export const ANALYTICS_WINDOWS: readonly AnalyticsWindow[] = [10, 25, 50, 100] as const;

/**
 * Confidence wording is deliberately constrained. There is no "high
 * confidence" option — round outcomes are independent, so no sample size
 * justifies that claim.
 */
export type ConfidenceLabel = 'No reliable signal' | 'Low confidence' | 'Moderate signal';

export interface OutcomeDistribution {
  DRAGON: number;
  TIGER: number;
  TIE: number;
}

export interface StreakInfo {
  /** The side currently repeating, or `null` when the last two differ. */
  side: Outcome | null;
  /** How many consecutive rounds the current streak spans. */
  length: number;
  /** Longest streak seen inside the analysed window. */
  longestInWindow: number;
  longestSide: Outcome | null;
}

/**
 * Every analytics figure carries its own provenance so no number can be
 * shown without its data period, sample size and method.
 */
export interface AnalyticsProvenance {
  /** Rounds actually included in the calculation. */
  sampleSize: number;
  /** The requested rolling window. */
  window: AnalyticsWindow;
  /** Human-readable description of how the figure was derived. */
  method: string;
  lastUpdated: ISODateString;
}

export interface AnalyticsSummary extends AnalyticsProvenance {
  /** Raw counts per outcome across the window. */
  counts: OutcomeDistribution;
  /** Observed frequency per outcome, 0–1. */
  frequencies: OutcomeDistribution;
  /** Observed tie rate, 0–1. */
  tieRate: number;
  streak: StreakInfo;
  /** Inclusive range of round timestamps covered. */
  periodStart: ISODateString;
  periodEnd: ISODateString;
}

/**
 * A model estimate. Every field here is mandatory — `PredictionCard` refuses
 * to render if `confidenceLabel`, `sampleSize` or `disclaimer` is missing,
 * so an estimate can never reach a player stripped of its caveats.
 */
export interface PredictionEstimate {
  modelCode: string;
  modelVersion: string;
  /** The side the model leans towards, or `null` when it has no lean. */
  estimatedSide: Outcome | null;
  /** Model's own probability for `estimatedSide`, 0–1. */
  probability: number;
  confidenceLabel: ConfidenceLabel;
  /** Rounds the estimate was computed from. */
  sampleSize: number;
  window: AnalyticsWindow;
  method: string;
  /** Model's historical hit rate on settled rounds, 0–1. */
  historicalAccuracy: number;
  /** Rounds the accuracy figure itself is based on. */
  accuracySampleSize: number;
  /** Mandatory independence notice. Rendered verbatim, never paraphrased. */
  disclaimer: string;
  lastUpdated: ISODateString;
}

export interface TrendPoint {
  date: ISODateString;
  DRAGON: number;
  TIGER: number;
  TIE: number;
  total: number;
}

export interface ModelStatus {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  minDataRounds: number;
  accuracy: number;
  totalPredictions: number;
  lastUpdated: ISODateString;
}

/* ------------------------------------------------------------------ */
/* Rewards & progression                                               */
/* ------------------------------------------------------------------ */

export type MissionStatus = 'locked' | 'in_progress' | 'completed' | 'claimed';

export type MissionCadence = 'daily' | 'weekly' | 'one_time';

export interface Mission {
  id: string;
  code: string;
  title: string;
  description: string;
  cadence: MissionCadence;
  rewardAmount: Coins;
  progress: number;
  target: number;
  status: MissionStatus;
  expiresAt: ISODateString | null;
}

export interface DailyReward {
  /** Consecutive days claimed, 1-based. */
  streakDay: number;
  streakLength: number;
  amount: Coins;
  claimable: boolean;
  nextClaimAt: ISODateString | null;
  lastClaimedAt: ISODateString | null;
}

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  rewardAmount: Coins;
  unlockedAt: ISODateString | null;
  progress: number;
  target: number;
}

export interface PromoRedemption {
  code: string;
  amount: Coins;
  redeemedAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* Tournaments                                                         */
/* ------------------------------------------------------------------ */

export type TournamentState = 'upcoming' | 'live' | 'ended' | 'cancelled';

export interface Tournament {
  id: string;
  code: string;
  name: string;
  description: string;
  mode: GameMode;
  state: TournamentState;
  startsAt: ISODateString;
  endsAt: ISODateString;
  entryFee: Coins;
  prizePool: Coins;
  playerCount: number;
  maxPlayers: number | null;
  /** Present when the current user has joined. */
  yourRank: number | null;
  yourScore: number | null;
  joined: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  prize: Coins | null;
  isCurrentUser: boolean;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export interface AppNotification {
  id: string;
  type: 'round' | 'reward' | 'tournament' | 'system' | 'social';
  title: string;
  body: string;
  readAt: ISODateString | null;
  createdAt: ISODateString;
}

/* ------------------------------------------------------------------ */
/* API envelopes                                                       */
/* ------------------------------------------------------------------ */

/** RFC 7807 `application/problem+json`. */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  correlationId?: string;
  /** Field-level validation errors, keyed by form field name. */
  errors?: Record<string, string[]>;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/**
 * The independence notice. Shown verbatim on every predictive surface.
 * Do not paraphrase, shorten, or hide behind a disclosure toggle.
 */
export const INDEPENDENCE_DISCLAIMER =
  'Every round is independent. Historical patterns do not determine future outcomes.';

export const DEFAULT_PAYOUTS: PayoutTable = {
  DRAGON: 1,
  TIGER: 1,
  TIE: 8,
};

export const QUICK_CHIP_AMOUNTS: readonly Coins[] = [10, 50, 100, 500, 1000] as const;
