/**
 * MOCK: Development fixtures used wherever the API is not wired up yet.
 *
 * Every export in this file is placeholder data. Replace each consumer with
 * a real TanStack Query call against the endpoints in PLAN.md §5 before
 * shipping. Nothing here should survive into production.
 */

import { resolveOutcome } from '@/lib/utils';
import {
  INDEPENDENCE_DISCLAIMER,
  type AnalyticsSummary,
  type AnalyticsWindow,
  type Achievement,
  type AppNotification,
  type CardRank,
  type CardSuit,
  type ConfidenceLabel,
  type DailyReward,
  type GameRoom,
  type LedgerEntry,
  type Mission,
  type ModelStatus,
  type Outcome,
  type PlayingCardData,
  type PredictionEstimate,
  type RoundResultSummary,
  type StreakInfo,
  type Tournament,
  type TrendPoint,
  type User,
  type Wallet,
} from '@/types';

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-randomness                                     */
/* ------------------------------------------------------------------ */

/** Mulberry32 — small, seeded, and stable across server and client renders. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANKS: readonly CardRank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];
const SUITS: readonly CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

function drawCard(rng: () => number): PlayingCardData {
  const rankIndex = Math.floor(rng() * RANKS.length);
  const suitIndex = Math.floor(rng() * SUITS.length);
  const rank = RANKS[rankIndex] ?? 'A';
  const suit = SUITS[suitIndex] ?? 'spades';
  return { rank, suit, value: rankIndex + 1 };
}

/** MOCK: a fixed "now" keeps SSR and hydration output identical. */
export const MOCK_NOW = new Date('2026-08-09T10:24:00.000Z');

function minutesAgo(minutes: number): string {
  return new Date(MOCK_NOW.getTime() - minutes * 60_000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(MOCK_NOW.getTime() - days * 86_400_000).toISOString();
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

export const mockUser: User = {
  id: 'usr_7f3a91c2',
  email: 'player@zitto.example',
  mobile: '+919812345678',
  displayName: 'Ravi Kumar',
  avatarUrl: null,
  locale: 'en',
  timezone: 'Asia/Kolkata',
  status: 'active',
  roles: ['player'],
  emailVerifiedAt: daysAgo(41),
  mobileVerifiedAt: daysAgo(41),
  ageConfirmedAt: daysAgo(41),
  twoFactorEnabled: false,
  createdAt: daysAgo(41),
};

export const mockWallet: Wallet = {
  id: 'wal_2b8e44a1',
  userId: mockUser.id,
  balance: 12_450,
  locked: 0,
  bonus: 500,
  updatedAt: minutesAgo(3),
};

export const mockLedger: LedgerEntry[] = [
  {
    id: 'led_01',
    walletId: mockWallet.id,
    userId: mockUser.id,
    type: 'win',
    amount: 200,
    balanceBefore: 12_250,
    balanceAfter: 12_450,
    sourceType: 'round',
    sourceId: 'rnd_10428',
    actorType: 'game_engine',
    description: 'Round #10428 — Dragon',
    createdAt: minutesAgo(3),
  },
  {
    id: 'led_02',
    walletId: mockWallet.id,
    userId: mockUser.id,
    type: 'bet',
    amount: -100,
    balanceBefore: 12_350,
    balanceAfter: 12_250,
    sourceType: 'round',
    sourceId: 'rnd_10428',
    actorType: 'user',
    description: 'Round #10428 — selection placed',
    createdAt: minutesAgo(4),
  },
  {
    id: 'led_03',
    walletId: mockWallet.id,
    userId: mockUser.id,
    type: 'daily_reward',
    amount: 100,
    balanceBefore: 12_250,
    balanceAfter: 12_350,
    sourceType: 'mission',
    sourceId: 'daily_login',
    actorType: 'system',
    description: 'Daily reward — day 4',
    createdAt: minutesAgo(180),
  },
  {
    id: 'led_04',
    walletId: mockWallet.id,
    userId: mockUser.id,
    type: 'mission',
    amount: 250,
    balanceBefore: 12_000,
    balanceAfter: 12_250,
    sourceType: 'mission',
    sourceId: 'msn_play_10',
    actorType: 'system',
    description: 'Mission complete — Play 10 rounds',
    createdAt: minutesAgo(320),
  },
];

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */

export const mockRooms: GameRoom[] = [
  {
    id: 'classic-01',
    name: 'Classic Table',
    mode: 'classic',
    status: 'open',
    playerCount: 128,
    maxPlayers: 500,
    minBet: 10,
    maxBet: 10_000,
    bettingDurationMs: 20_000,
    inviteCode: null,
  },
  {
    id: 'quick-01',
    name: 'Quick Draw',
    mode: 'quick',
    status: 'open',
    playerCount: 64,
    maxPlayers: 500,
    minBet: 10,
    maxBet: 2_000,
    bettingDurationMs: 10_000,
    inviteCode: null,
  },
  {
    id: 'practice-01',
    name: 'Practice Table',
    mode: 'practice',
    status: 'open',
    playerCount: 12,
    maxPlayers: 100,
    minBet: 10,
    maxBet: 500,
    bettingDurationMs: 25_000,
    inviteCode: null,
  },
  {
    id: 'tournament-01',
    name: 'Weekly Championship',
    mode: 'tournament',
    status: 'open',
    playerCount: 342,
    maxPlayers: 1_000,
    minBet: 50,
    maxBet: 5_000,
    bettingDurationMs: 20_000,
    inviteCode: null,
  },
];

/** MOCK: generate a plausible outcome history, newest first. */
export function generateOutcomeHistory(count: number, seed = 20260809): Outcome[] {
  const rng = seededRandom(seed);
  const outcomes: Outcome[] = [];
  for (let i = 0; i < count; i += 1) {
    const dragon = drawCard(rng);
    const tiger = drawCard(rng);
    outcomes.push(resolveOutcome(dragon, tiger));
  }
  return outcomes;
}

export const mockOutcomeHistory: Outcome[] = generateOutcomeHistory(100);

/** MOCK: recent settled rounds with cards, newest first. */
export function generateRecentRounds(count: number, seed = 771): RoundResultSummary[] {
  const rng = seededRandom(seed);
  const rounds: RoundResultSummary[] = [];

  for (let i = 0; i < count; i += 1) {
    const dragonCard = drawCard(rng);
    const tigerCard = drawCard(rng);
    const outcome = resolveOutcome(dragonCard, tigerCard);
    const roundNumber = 10_428 - i;

    rounds.push({
      roundId: `rnd_${roundNumber}`,
      roundNumber,
      outcome,
      dragonCard,
      tigerCard,
      settledAt: minutesAgo(i * 2 + 3),
      yourSelection: null,
    });
  }

  return rounds;
}

export const mockRecentRounds: RoundResultSummary[] = generateRecentRounds(12);

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

function computeStreak(history: Outcome[]): StreakInfo {
  if (history.length === 0) {
    return { side: null, length: 0, longestInWindow: 0, longestSide: null };
  }

  const current = history[0] ?? null;
  let length = 0;
  for (const outcome of history) {
    if (outcome !== current) break;
    length += 1;
  }

  let longestInWindow = 0;
  let longestSide: Outcome | null = null;
  let runSide: Outcome | null = null;
  let runLength = 0;

  for (const outcome of history) {
    if (outcome === runSide) {
      runLength += 1;
    } else {
      runSide = outcome;
      runLength = 1;
    }
    if (runLength > longestInWindow) {
      longestInWindow = runLength;
      longestSide = runSide;
    }
  }

  return {
    side: length > 1 ? current : null,
    length: length > 1 ? length : 0,
    longestInWindow,
    longestSide,
  };
}

/** MOCK: summary derived from the generated history, so figures agree. */
export function buildAnalyticsSummary(window: AnalyticsWindow): AnalyticsSummary {
  const slice = mockOutcomeHistory.slice(0, window);
  const counts = { DRAGON: 0, TIGER: 0, TIE: 0 };

  for (const outcome of slice) {
    counts[outcome] += 1;
  }

  const sampleSize = slice.length;
  const safeDivide = (value: number): number => (sampleSize === 0 ? 0 : value / sampleSize);

  return {
    sampleSize,
    window,
    method: `Rolling frequency count over the last ${sampleSize} settled rounds on this table. Each round counted once, no weighting applied.`,
    lastUpdated: minutesAgo(3),
    counts,
    frequencies: {
      DRAGON: safeDivide(counts.DRAGON),
      TIGER: safeDivide(counts.TIGER),
      TIE: safeDivide(counts.TIE),
    },
    tieRate: safeDivide(counts.TIE),
    streak: computeStreak(slice),
    periodStart: minutesAgo(sampleSize * 2 + 3),
    periodEnd: minutesAgo(3),
  };
}

export const mockAnalyticsSummary: AnalyticsSummary = buildAnalyticsSummary(50);

/**
 * MOCK: a model estimate.
 *
 * Confidence never exceeds "Moderate signal" — Dragon Tiger rounds are
 * independent draws, so no sample size supports a stronger claim. The
 * disclaimer is attached at source so it cannot be dropped downstream.
 */
export function buildPrediction(window: AnalyticsWindow): PredictionEstimate {
  const summary = buildAnalyticsSummary(window);
  const { DRAGON, TIGER } = summary.frequencies;

  const lean: Outcome | null =
    Math.abs(DRAGON - TIGER) < 0.04 ? null : DRAGON > TIGER ? 'DRAGON' : 'TIGER';

  const probability = lean === 'DRAGON' ? DRAGON : lean === 'TIGER' ? TIGER : 0.5;

  let confidenceLabel: ConfidenceLabel;
  if (lean === null || summary.sampleSize < 25) {
    confidenceLabel = 'No reliable signal';
  } else if (summary.sampleSize >= 50 && Math.abs(DRAGON - TIGER) > 0.12) {
    confidenceLabel = 'Moderate signal';
  } else {
    confidenceLabel = 'Low confidence';
  }

  return {
    modelCode: `freq_rolling_${window}`,
    modelVersion: '1.4.0',
    estimatedSide: lean,
    probability,
    confidenceLabel,
    sampleSize: summary.sampleSize,
    window,
    method: `Rolling frequency model. Compares observed Dragon and Tiger rates across the last ${summary.sampleSize} settled rounds. No card-counting or seed inspection is involved.`,
    historicalAccuracy: 0.492,
    accuracySampleSize: 8_412,
    disclaimer: INDEPENDENCE_DISCLAIMER,
    lastUpdated: minutesAgo(3),
  };
}

export const mockPrediction: PredictionEstimate = buildPrediction(50);

export const mockModelStatus: ModelStatus = {
  code: 'freq_rolling_50',
  name: 'Rolling frequency (50)',
  description:
    'Counts how often each side has come up across a rolling 50-round window. A statistical observation of past rounds only.',
  enabled: true,
  minDataRounds: 25,
  accuracy: 0.492,
  totalPredictions: 8_412,
  lastUpdated: minutesAgo(3),
};

/** MOCK: daily outcome counts for the trends chart. */
export function buildTrendPoints(days = 14, seed = 4211): TrendPoint[] {
  const rng = seededRandom(seed);
  const points: TrendPoint[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const total = 180 + Math.floor(rng() * 60);
    const tie = Math.floor(total * (0.06 + rng() * 0.04));
    const dragon = Math.floor((total - tie) * (0.46 + rng() * 0.08));
    const tiger = total - tie - dragon;

    points.push({
      date: daysAgo(i),
      DRAGON: dragon,
      TIGER: tiger,
      TIE: tie,
      total,
    });
  }

  return points;
}

export const mockTrendPoints: TrendPoint[] = buildTrendPoints();

/* ------------------------------------------------------------------ */
/* Rewards                                                             */
/* ------------------------------------------------------------------ */

export const mockDailyReward: DailyReward = {
  streakDay: 4,
  streakLength: 7,
  amount: 100,
  claimable: true,
  nextClaimAt: null,
  lastClaimedAt: daysAgo(1),
};

export const mockMissions: Mission[] = [
  {
    id: 'msn_01',
    code: 'play_10_rounds',
    title: 'Play 10 rounds',
    description: 'Take part in 10 rounds on any table today.',
    cadence: 'daily',
    rewardAmount: 250,
    progress: 7,
    target: 10,
    status: 'in_progress',
    expiresAt: new Date(MOCK_NOW.getTime() + 13 * 3_600_000).toISOString(),
  },
  {
    id: 'msn_02',
    code: 'view_analytics',
    title: 'Review your analytics',
    description: 'Open the analytics dashboard and check a rolling window.',
    cadence: 'daily',
    rewardAmount: 50,
    progress: 1,
    target: 1,
    status: 'completed',
    expiresAt: new Date(MOCK_NOW.getTime() + 13 * 3_600_000).toISOString(),
  },
  {
    id: 'msn_03',
    code: 'weekly_100',
    title: 'Weekly regular',
    description: 'Play 100 rounds across the week.',
    cadence: 'weekly',
    rewardAmount: 1_000,
    progress: 62,
    target: 100,
    status: 'in_progress',
    expiresAt: new Date(MOCK_NOW.getTime() + 3 * 86_400_000).toISOString(),
  },
  {
    id: 'msn_04',
    code: 'set_limits',
    title: 'Set a session limit',
    description: 'Choose a session time limit in Responsible Gaming settings.',
    cadence: 'one_time',
    rewardAmount: 300,
    progress: 0,
    target: 1,
    status: 'in_progress',
    expiresAt: null,
  },
];

export const mockAchievements: Achievement[] = [
  {
    id: 'ach_01',
    code: 'first_round',
    title: 'First hand',
    description: 'Play your first round.',
    rewardAmount: 100,
    unlockedAt: daysAgo(41),
    progress: 1,
    target: 1,
  },
  {
    id: 'ach_02',
    code: 'analyst',
    title: 'Analyst',
    description: 'Review analytics on 20 separate days.',
    rewardAmount: 500,
    unlockedAt: null,
    progress: 12,
    target: 20,
  },
];

/* ------------------------------------------------------------------ */
/* Tournaments                                                         */
/* ------------------------------------------------------------------ */

export const mockTournament: Tournament = {
  id: 'trn_weekly_32',
  code: 'WEEKLY32',
  name: 'Weekly Championship',
  description: 'Climb the leaderboard across the week. Top 100 share the prize pool.',
  mode: 'tournament',
  state: 'live',
  startsAt: daysAgo(2),
  endsAt: new Date(MOCK_NOW.getTime() + 4 * 86_400_000).toISOString(),
  entryFee: 500,
  prizePool: 250_000,
  playerCount: 342,
  maxPlayers: 1_000,
  yourRank: 47,
  yourScore: 3_820,
  joined: true,
};

export const mockTournaments: Tournament[] = [
  mockTournament,
  {
    id: 'trn_daily_88',
    code: 'DAILY88',
    name: 'Daily Sprint',
    description: 'A short, fast tournament. Resets every midnight IST.',
    mode: 'tournament',
    state: 'upcoming',
    startsAt: new Date(MOCK_NOW.getTime() + 6 * 3_600_000).toISOString(),
    endsAt: new Date(MOCK_NOW.getTime() + 30 * 3_600_000).toISOString(),
    entryFee: 100,
    prizePool: 40_000,
    playerCount: 88,
    maxPlayers: 500,
    yourRank: null,
    yourScore: null,
    joined: false,
  },
];

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const mockNotifications: AppNotification[] = [
  {
    id: 'ntf_01',
    type: 'reward',
    title: 'Daily reward ready',
    body: 'Day 4 of your streak is available to claim.',
    readAt: null,
    createdAt: minutesAgo(180),
  },
  {
    id: 'ntf_02',
    type: 'tournament',
    title: 'You moved up to rank 47',
    body: 'Weekly Championship — 4 days remaining.',
    readAt: null,
    createdAt: minutesAgo(240),
  },
];

export const mockUnreadNotificationCount = mockNotifications.filter((n) => !n.readAt).length;
