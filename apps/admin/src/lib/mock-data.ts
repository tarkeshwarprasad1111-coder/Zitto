/**
 * MOCK: in-memory fixtures for the admin console.
 *
 * Every query in `src/app` is written against the real REST v1 shapes and
 * currently resolves against this module. Swapping a page onto the live API is
 * a one-line change in its `queryFn` — replace `mock.xyz()` with `api.get(...)`
 * and delete nothing else.
 *
 * Data is generated from a fixed seed so server and client renders agree and
 * screenshots stay stable between reloads.
 */

import type {
  AchievementConfig,
  AdminUser,
  AuditLogEntry,
  BannerConfig,
  CmsPageSummary,
  DailyRewardTier,
  DashboardStats,
  FeatureFlag,
  GameConfig,
  GameRoundDetail,
  GameRoundSummary,
  LedgerEntry,
  LedgerEntryType,
  ManagedUser,
  MissionConfig,
  Outcome,
  PaginatedResponse,
  PlayingCardData,
  PredictionModelConfig,
  PromoCode,
  ReconciliationStatus,
  Report,
  RoundBet,
  RoundState,
  ServiceHealth,
  SupportTicket,
  TicketPriority,
  TicketStatus,
  TournamentSummary,
  TrendPoint,
  UserDetail,
  UserNote,
  UserSession,
  UserStatus,
} from '@/types';

/* ------------------------------------------------------------------ */
/* Deterministic RNG                                                   */
/* ------------------------------------------------------------------ */

/** mulberry32 — small, fast, and stable across runtimes. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = createRng(20260809);

function pick<T>(items: readonly T[], rng: () => number = rand): T {
  const index = Math.floor(rng() * items.length);
  // `noUncheckedIndexedAccess` — the modulo keeps this in range, but the
  // compiler cannot know that.
  return items[Math.min(index, items.length - 1)] as T;
}

function intBetween(min: number, max: number, rng: () => number = rand): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Fixed "now" so relative timestamps do not drift between renders. */
export const MOCK_NOW = new Date('2026-08-09T10:30:00.000Z');

function minutesAgo(minutes: number): string {
  return new Date(MOCK_NOW.getTime() - minutes * 60_000).toISOString();
}

function daysAgo(days: number): string {
  return minutesAgo(days * 24 * 60);
}

function hex(length: number, rng: () => number = rand): string {
  let out = '';
  const alphabet = '0123456789abcdef';
  for (let index = 0; index < length; index += 1) out += pick(alphabet.split(''), rng);
  return out;
}

/** Simulates network latency so loading states are actually exercised. */
export function mockDelay<T>(value: T, ms = 320): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/* ------------------------------------------------------------------ */
/* Cursor pagination over a fixture array                              */
/* ------------------------------------------------------------------ */

/**
 * MOCK: cursors are just `offset:<n>` here. The real API issues opaque
 * cursors; the console never parses them, so the shape is interchangeable.
 */
export function paginate<T>(
  items: readonly T[],
  cursor: string | null | undefined,
  limit: number,
): PaginatedResponse<T> {
  const offset = cursor ? Number.parseInt(cursor.replace('offset:', ''), 10) || 0 : 0;
  const slice = items.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const hasMore = nextOffset < items.length;

  return {
    items: slice,
    nextCursor: hasMore ? `offset:${nextOffset}` : null,
    prevCursor: offset > 0 ? `offset:${Math.max(0, offset - limit)}` : null,
    hasMore,
    totalCount: items.length,
  };
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

const FIRST_NAMES = [
  'Aarav', 'Diya', 'Rohan', 'Ananya', 'Vikram', 'Priya', 'Kabir', 'Meera', 'Arjun', 'Sneha',
  'Rahul', 'Ishita', 'Karan', 'Nisha', 'Aditya', 'Pooja', 'Siddharth', 'Riya', 'Manav', 'Tara',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Verma', 'Singh', 'Gupta', 'Joshi', 'Kulkarni',
  'Menon', 'Chopra', 'Desai', 'Bose', 'Malhotra',
];

export const MOCK_ADMIN: AdminUser = {
  id: 'adm_01HZX9K2M4',
  email: 'ops.lead@zitto.example',
  displayName: 'Rajkumar Vishwakarma',
  avatarUrl: null,
  roles: ['admin', 'super_admin'],
  permissions: [
    'users.read', 'users.suspend', 'users.credit', 'rounds.read', 'rounds.void',
    'ledger.read', 'ledger.export', 'config.write', 'flags.write', 'cms.write',
    'tickets.write', 'reports.write', 'audit.read',
  ],
  twoFactorEnabled: true,
  lastLoginAt: minutesAgo(42),
  createdAt: daysAgo(410),
};

const ADMIN_NAMES = ['Rajkumar Vishwakarma', 'Neha Kapoor', 'Sameer Rao', 'system'];

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

const USER_STATUSES: UserStatus[] = ['active', 'active', 'active', 'active', 'suspended', 'self_excluded'];

function buildUsers(count: number): ManagedUser[] {
  const rng = createRng(4711);
  const users: ManagedUser[] = [];

  for (let index = 0; index < count; index += 1) {
    const first = pick(FIRST_NAMES, rng);
    const last = pick(LAST_NAMES, rng);
    const displayName = `${first} ${last}`;
    const handle = `${first}.${last}`.toLowerCase();
    const status = pick(USER_STATUSES, rng);
    const createdDaysAgo = intBetween(1, 400, rng);
    const hasEmail = rng() > 0.15;
    const verified = rng() > 0.25;

    users.push({
      id: `usr_${(100000 + index).toString(36).padStart(8, '0')}`,
      displayName,
      email: hasEmail ? `${handle}${index}@example.com` : null,
      mobile: rng() > 0.35 ? `+9198${intBetween(10000000, 99999999, rng)}` : null,
      avatarUrl: null,
      status,
      roles: ['player'],
      locale: rng() > 0.6 ? 'hi' : 'en',
      balance: String(intBetween(0, 480_000, rng)),
      emailVerifiedAt: hasEmail && verified ? daysAgo(createdDaysAgo - 1) : null,
      mobileVerifiedAt: verified ? daysAgo(createdDaysAgo - 1) : null,
      kycStatus: verified ? 'approved' : rng() > 0.7 ? 'pending' : 'not_started',
      createdAt: daysAgo(createdDaysAgo),
      lastActiveAt: rng() > 0.1 ? minutesAgo(intBetween(2, 20_000, rng)) : null,
      suspendedReason:
        status === 'suspended'
          ? pick(
              [
                'Multiple accounts linked to one device fingerprint.',
                'Chat abuse reported by three separate players.',
                'Automated bet timing pattern flagged by fraud review.',
              ],
              rng,
            )
          : null,
      suspendedUntil: status === 'suspended' ? daysAgo(-intBetween(2, 30, rng)) : null,
      flagCount: rng() > 0.85 ? intBetween(1, 4, rng) : 0,
    });
  }

  return users;
}

export const MOCK_USERS: ManagedUser[] = buildUsers(147);

export function findUser(id: string): ManagedUser | undefined {
  return MOCK_USERS.find((user) => user.id === id);
}

export function buildUserDetail(id: string): UserDetail | null {
  const base = findUser(id) ?? MOCK_USERS[0];
  if (!base) return null;

  const rng = createRng(id.length * 977 + 13);
  const balance = Number(base.balance);

  return {
    ...base,
    id,
    wallet: {
      balance: String(balance),
      locked: String(intBetween(0, 2_000, rng)),
      bonus: String(intBetween(0, 15_000, rng)),
      lifetimeWagered: String(intBetween(50_000, 9_400_000, rng)),
      lifetimeWon: String(intBetween(40_000, 9_100_000, rng)),
      updatedAt: minutesAgo(intBetween(1, 600, rng)),
    },
    responsibleGaming: {
      dailyLossLimit: rng() > 0.5 ? String(intBetween(5_000, 50_000, rng)) : null,
      sessionTimeLimitMinutes: rng() > 0.6 ? pick([30, 60, 120], rng) : null,
      dailyRoundLimit: rng() > 0.7 ? pick([50, 100, 250], rng) : null,
      enabledAt: rng() > 0.5 ? daysAgo(intBetween(5, 90, rng)) : null,
    },
    selfExclusion:
      base.status === 'self_excluded'
        ? {
            active: true,
            startedAt: daysAgo(12),
            endsAt: daysAgo(-18),
            durationDays: 30,
          }
        : { active: false, startedAt: null, endsAt: null, durationDays: null },
    stats: {
      roundsPlayed: intBetween(12, 24_000, rng),
      winRate: 0.42 + rng() * 0.14,
      biggestWin: String(intBetween(2_000, 340_000, rng)),
      referrals: intBetween(0, 18, rng),
    },
  };
}

export function buildUserSessions(userId: string): UserSession[] {
  const rng = createRng(userId.length * 31 + 7);
  const devices = [
    'Pixel 7a · Android 14',
    'iPhone 13 · iOS 17.4',
    'Chrome 122 · Windows 11',
    'Samsung M34 · Android 13',
  ];

  return Array.from({ length: intBetween(1, 4, rng) }, (_, index) => ({
    id: `ses_${hex(10, rng)}`,
    deviceLabel: devices[index % devices.length] ?? 'Unknown device',
    ipAddress: `49.${intBetween(1, 254, rng)}.${intBetween(1, 254, rng)}.${intBetween(1, 254, rng)}`,
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
    location: pick(['Mumbai, IN', 'Pune, IN', 'Bengaluru, IN', 'Delhi, IN', null], rng),
    createdAt: minutesAgo(intBetween(60, 20_000, rng)),
    lastSeenAt: minutesAgo(intBetween(1, 900, rng)),
    current: index === 0,
  }));
}

export function buildUserNotes(userId: string): UserNote[] {
  const rng = createRng(userId.length * 53 + 3);
  const bodies = [
    'Player contacted support about a stuck round. Verified the round settled correctly; no adjustment needed.',
    'Verified identity documents on file. KYC approved.',
    'Repeated chat warnings issued. Escalate to suspension if it continues.',
    'Requested a deposit limit reduction; applied at their request.',
  ];

  return Array.from({ length: intBetween(1, 3, rng) }, (_, index) => ({
    id: `note_${hex(8, rng)}`,
    userId,
    authorName: pick(ADMIN_NAMES.slice(0, 3), rng),
    authorId: `adm_${hex(8, rng)}`,
    body: bodies[index % bodies.length] ?? bodies[0] ?? '',
    createdAt: daysAgo(intBetween(1, 120, rng)),
  }));
}

/* ------------------------------------------------------------------ */
/* Rounds                                                              */
/* ------------------------------------------------------------------ */

const ROOMS = [
  { id: 'room_classic_01', name: 'Classic · Table 1', mode: 'CLASSIC' as const },
  { id: 'room_classic_02', name: 'Classic · Table 2', mode: 'CLASSIC' as const },
  { id: 'room_quick_01', name: 'Quick · Table 1', mode: 'QUICK' as const },
  { id: 'room_practice_01', name: 'Practice · Table 1', mode: 'PRACTICE' as const },
  { id: 'room_tour_01', name: 'Weekend Cup · Arena', mode: 'TOURNAMENT' as const },
];

const RANKS: PlayingCardData['rank'][] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
];
const SUITS: PlayingCardData['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];

function buildCard(rng: () => number): PlayingCardData {
  const rank = pick(RANKS, rng);
  return { rank, suit: pick(SUITS, rng), value: RANKS.indexOf(rank) + 1 };
}

function buildRounds(count: number): GameRoundSummary[] {
  const rng = createRng(90210);
  const rounds: GameRoundSummary[] = [];

  for (let index = 0; index < count; index += 1) {
    const room = pick(ROOMS, rng);
    const minutesBack = index * 3 + intBetween(0, 2, rng);
    // The two most recent rounds are still running.
    const state: RoundState = index === 0 ? 'BETTING' : index === 1 ? 'DRAWING' : rng() > 0.985 ? 'VOIDED' : 'SETTLED';
    const settled = state === 'SETTLED';
    const outcome: Outcome | null = settled ? pick(['DRAGON', 'TIGER', 'TIE', 'DRAGON', 'TIGER'], rng) : null;
    const wagered = intBetween(2_000, 340_000, rng);
    const paid = settled ? Math.round(wagered * (0.82 + rng() * 0.3)) : 0;

    rounds.push({
      id: `rnd_${(900000 - index).toString(36)}`,
      roundNumber: 184_920 - index,
      roomId: room.id,
      roomName: room.name,
      mode: room.mode,
      state,
      outcome,
      betsCount: intBetween(4, 220, rng),
      playersCount: intBetween(3, 140, rng),
      coinsWagered: String(wagered),
      coinsPaidOut: String(paid),
      startedAt: minutesAgo(minutesBack + 1),
      settledAt: settled ? minutesAgo(minutesBack) : null,
      voidReason:
        state === 'VOIDED'
          ? 'Game engine lost quorum mid-draw; all stakes refunded via an appended correction.'
          : null,
    });
  }

  return rounds;
}

export const MOCK_ROUNDS: GameRoundSummary[] = buildRounds(240);

export function buildRoundDetail(id: string): GameRoundDetail | null {
  const base = MOCK_ROUNDS.find((round) => round.id === id) ?? MOCK_ROUNDS[2];
  if (!base) return null;

  const rng = createRng(id.length * 613 + 29);
  const settled = base.state === 'SETTLED';

  const bets: RoundBet[] = Array.from({ length: Math.min(base.betsCount, 40) }, (_, index) => {
    const user = MOCK_USERS[index % MOCK_USERS.length];
    const selection = pick<Outcome>(['DRAGON', 'TIGER', 'TIE', 'DRAGON', 'TIGER'], rng);
    const amount = intBetween(100, 25_000, rng);
    const won = settled && selection === base.outcome;
    const multiplier = selection === 'TIE' ? 8 : 2;

    return {
      id: `bet_${hex(10, rng)}`,
      userId: user?.id ?? 'usr_unknown',
      displayName: user?.displayName ?? 'Unknown player',
      selection,
      amount: String(amount),
      payout: String(won ? amount * multiplier : 0),
      status: base.state === 'VOIDED' ? 'VOIDED' : settled ? (won ? 'WON' : 'LOST') : 'PLACED',
      placedAt: base.startedAt,
    };
  });

  return {
    ...base,
    id,
    fairness: {
      algorithm: 'HMAC-SHA256(serverSeed, clientSeed:nonce) → Fisher-Yates shuffle',
      serverSeedHash: hex(64, rng),
      // The seed is withheld until the round settles — publishing it during
      // betting would let anyone derive the cards early.
      serverSeed: settled ? hex(64, rng) : null,
      clientSeed: hex(32, rng),
      nonce: base.roundNumber,
      combinedHash: settled ? hex(64, rng) : null,
      derivedCards: settled ? { dragon: buildCard(rng), tiger: buildCard(rng) } : null,
      signature: settled ? hex(128, rng) : null,
      signaturePublicKeyId: settled ? 'fairness-key-2026-q3' : null,
      verifiedAt: settled ? base.settledAt : null,
    },
    bets,
    phaseTimings: { bettingMs: 15_000, drawingMs: 5_000, resultMs: 8_000 },
    corrections:
      base.state === 'VOIDED'
        ? [
            {
              id: `cor_${hex(10, rng)}`,
              roundId: base.id,
              actorName: 'Neha Kapoor',
              actorId: 'adm_02JK1',
              reason:
                'Game engine lost quorum mid-draw. Round voided and every stake refunded in full.',
              netAdjustment: base.coinsWagered,
              affectedUserCount: base.playersCount,
              createdAt: minutesAgo(30),
            },
          ]
        : [],
  };
}

/* ------------------------------------------------------------------ */
/* Ledger                                                              */
/* ------------------------------------------------------------------ */

const LEDGER_TYPES: LedgerEntryType[] = [
  'bet', 'bet', 'bet', 'win', 'win', 'refund', 'daily_reward', 'mission',
  'achievement', 'referral', 'promo', 'admin_credit', 'tournament_entry',
  'tournament_prize', 'correction',
];

function buildLedger(count: number, userId?: string): LedgerEntry[] {
  const rng = createRng(userId ? userId.length * 191 + 5 : 31337);
  const entries: LedgerEntry[] = [];
  let running = intBetween(20_000, 200_000, rng);

  for (let index = 0; index < count; index += 1) {
    const user = userId
      ? (findUser(userId) ?? MOCK_USERS[0])
      : MOCK_USERS[intBetween(0, MOCK_USERS.length - 1, rng)];
    const type = pick(LEDGER_TYPES, rng);
    const debit = type === 'bet' || type === 'admin_debit' || type === 'tournament_entry';
    const magnitude = intBetween(50, 30_000, rng);
    const delta = debit ? -magnitude : magnitude;
    const before = running;
    running = Math.max(0, running + delta);

    entries.push({
      id: `led_${(800000 - index).toString(36)}`,
      userId: user?.id ?? 'usr_unknown',
      displayName: user?.displayName ?? 'Unknown player',
      type,
      amount: String(delta),
      balanceBefore: String(before),
      balanceAfter: String(running),
      sourceType:
        type === 'bet' || type === 'win' || type === 'refund'
          ? 'round'
          : type === 'admin_credit' || type === 'admin_debit' || type === 'correction'
            ? 'admin'
            : type === 'mission'
              ? 'mission'
              : type === 'promo'
                ? 'promo_code'
                : null,
      sourceId: `src_${hex(8, rng)}`,
      actorType:
        type === 'admin_credit' || type === 'admin_debit' || type === 'correction'
          ? 'admin'
          : type === 'bet'
            ? 'user'
            : 'game_engine',
      actorId: null,
      description:
        type === 'correction'
          ? 'Appended correction for voided round 184,617 — original entries left untouched.'
          : type === 'admin_credit'
            ? 'Goodwill credit issued after a support investigation.'
            : `${type.replace(/_/g, ' ')} settlement`,
      createdAt: minutesAgo(index * 7 + intBetween(0, 4, rng)),
    });
  }

  return entries;
}

export const MOCK_LEDGER: LedgerEntry[] = buildLedger(320);

export function buildUserLedger(userId: string): LedgerEntry[] {
  return buildLedger(45, userId);
}

export const MOCK_RECONCILIATION: ReconciliationStatus = {
  ledgerTotal: '48293117420',
  walletTotal: '48293117420',
  difference: '0',
  balanced: true,
  mismatchedWallets: 0,
  checkedAt: minutesAgo(6),
};

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

const AUDIT_ACTIONS = [
  { action: 'user.suspend', targetType: 'user' },
  { action: 'user.activate', targetType: 'user' },
  { action: 'user.credit', targetType: 'user' },
  { action: 'user.note.create', targetType: 'user' },
  { action: 'round.void', targetType: 'game_round' },
  { action: 'game_config.update', targetType: 'app_setting' },
  { action: 'feature_flag.update', targetType: 'feature_flag' },
  { action: 'cms_page.publish', targetType: 'cms_page' },
  { action: 'promo_code.create', targetType: 'promo_code' },
  { action: 'ticket.assign', targetType: 'support_ticket' },
  { action: 'session.revoke', targetType: 'session' },
  { action: 'prediction_model.auto_disable', targetType: 'prediction_model' },
];

const AUDIT_REASONS = [
  'Fraud review confirmed multi-accounting across three devices.',
  'Player appealed successfully; suspension lifted after review.',
  'Goodwill credit after a confirmed engine fault during round 184,617.',
  'Scheduled configuration change approved in change ticket CHG-2291.',
  'Accuracy fell below the published floor; model disabled automatically.',
  null,
];

function buildAuditLogs(count: number): AuditLogEntry[] {
  const rng = createRng(5150);

  return Array.from({ length: count }, (_, index) => {
    const entry = pick(AUDIT_ACTIONS, rng);
    const isSystem = entry.action.includes('auto_');

    return {
      id: `aud_${(700000 - index).toString(36)}`,
      actorType: isSystem ? ('system' as const) : ('admin' as const),
      actorId: isSystem ? null : `adm_${hex(8, rng)}`,
      actorName: isSystem ? 'system' : pick(ADMIN_NAMES.slice(0, 3), rng),
      action: entry.action,
      targetType: entry.targetType,
      targetId: `${entry.targetType.slice(0, 3)}_${hex(8, rng)}`,
      reason: pick(AUDIT_REASONS, rng),
      ipAddress: isSystem ? null : `10.24.${intBetween(0, 255, rng)}.${intBetween(1, 254, rng)}`,
      metadata: { correlationId: hex(16, rng) },
      createdAt: minutesAgo(index * 11 + intBetween(0, 6, rng)),
    };
  });
}

export const MOCK_AUDIT_LOGS: AuditLogEntry[] = buildAuditLogs(180);

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function buildRoundsPerHour(): TrendPoint[] {
  const rng = createRng(2468);

  return Array.from({ length: 24 }, (_, index) => {
    const hour = (MOCK_NOW.getUTCHours() - 23 + index + 24) % 24;
    // Evening peak — Indian players cluster between 19:00 and 23:00 IST.
    const peak = hour >= 14 && hour <= 18 ? 1.9 : hour >= 2 && hour <= 6 ? 0.35 : 1;
    return {
      timestamp: new Date(MOCK_NOW.getTime() - (23 - index) * 3_600_000).toISOString(),
      label: `${hour.toString().padStart(2, '0')}:00`,
      value: Math.round((620 + rng() * 260) * peak),
    };
  });
}

const MOCK_HEALTH: ServiceHealth[] = [
  { name: 'API', status: 'healthy', latencyMs: 42, detail: 'p95 118ms', checkedAt: minutesAgo(1) },
  { name: 'Database', status: 'healthy', latencyMs: 7, detail: '18 / 100 connections', checkedAt: minutesAgo(1) },
  { name: 'Redis', status: 'healthy', latencyMs: 2, detail: 'memory 41%', checkedAt: minutesAgo(1) },
  {
    name: 'Game Engine',
    status: 'degraded',
    latencyMs: 310,
    detail: 'Table 2 settling ~300ms slower than target',
    checkedAt: minutesAgo(1),
  },
];

export const MOCK_DASHBOARD: DashboardStats = {
  totalUsers: 128_477,
  activeToday: 14_902,
  newRegistrations7d: 3_218,
  roundsPlayedToday: 18_446,
  coinsInCirculation: '48293117420',
  openTickets: 37,
  fraudAlerts: 6,
  deltas: {
    totalUsers: 0.021,
    activeToday: 0.084,
    newRegistrations7d: -0.032,
    roundsPlayedToday: 0.061,
    coinsInCirculation: 0.013,
    openTickets: 0.19,
    fraudAlerts: -0.25,
  },
  roundsPerHour: buildRoundsPerHour(),
  outcomeDistribution: { dragon: 8_142, tiger: 8_017, tie: 2_287 },
  systemHealth: MOCK_HEALTH,
  recentAudit: MOCK_AUDIT_LOGS.slice(0, 6),
};

/* ------------------------------------------------------------------ */
/* Game config                                                         */
/* ------------------------------------------------------------------ */

export const MOCK_GAME_CONFIG: GameConfig = {
  modes: [
    { mode: 'CLASSIC', label: 'Classic', enabled: true },
    { mode: 'QUICK', label: 'Quick', enabled: true },
    { mode: 'PRACTICE', label: 'Practice', enabled: true },
    { mode: 'PRIVATE', label: 'Private tables', enabled: false },
    { mode: 'PUBLIC', label: 'Public tables', enabled: true },
    { mode: 'TOURNAMENT', label: 'Tournament', enabled: true },
  ],
  phases: { bettingMs: 15_000, drawingMs: 5_000, resultMs: 8_000 },
  payouts: { dragon: 2, tiger: 2, tie: 8, tieRefundRatio: 0.5 },
  limits: { minBet: 10, maxBet: 50_000, maxBetsPerRound: 3 },
  maintenance: {
    enabled: false,
    message: 'Zitto is briefly offline for scheduled maintenance. We will be back shortly.',
  },
  updatedAt: daysAgo(4),
  updatedBy: 'Neha Kapoor',
};

/* ------------------------------------------------------------------ */
/* Rewards                                                             */
/* ------------------------------------------------------------------ */

export const MOCK_DAILY_REWARDS: DailyRewardTier[] = Array.from({ length: 7 }, (_, index) => ({
  id: `drw_${index + 1}`,
  day: index + 1,
  coins: String(500 * (index + 1) + (index === 6 ? 2_000 : 0)),
  streakBonus: index === 6 ? 1.5 : 1,
  enabled: true,
}));

export const MOCK_MISSIONS: MissionConfig[] = [
  {
    id: 'msn_01', code: 'daily_play_10', title: 'Play 10 rounds',
    description: 'Take part in ten rounds in any mode today.',
    type: 'DAILY', triggerEvent: 'round.settled', targetCount: 10,
    rewardCoins: '750', enabled: true, startsAt: null, endsAt: null, updatedAt: daysAgo(11),
  },
  {
    id: 'msn_02', code: 'daily_win_3', title: 'Win 3 rounds',
    description: 'Win three rounds today.',
    type: 'DAILY', triggerEvent: 'round.won', targetCount: 3,
    rewardCoins: '1200', enabled: true, startsAt: null, endsAt: null, updatedAt: daysAgo(11),
  },
  {
    id: 'msn_03', code: 'weekly_marathon', title: 'Weekly marathon',
    description: 'Play 150 rounds across the week.',
    type: 'WEEKLY', triggerEvent: 'round.settled', targetCount: 150,
    rewardCoins: '9000', enabled: true, startsAt: daysAgo(3), endsAt: daysAgo(-4), updatedAt: daysAgo(3),
  },
  {
    id: 'msn_04', code: 'onboarding_profile', title: 'Complete your profile',
    description: 'Add a display name and verify your contact details.',
    type: 'ONETIME', triggerEvent: 'profile.completed', targetCount: 1,
    rewardCoins: '2000', enabled: true, startsAt: null, endsAt: null, updatedAt: daysAgo(60),
  },
  {
    id: 'msn_05', code: 'weekend_tie_hunter', title: 'Tie hunter',
    description: 'Correctly call five ties in a weekend.',
    type: 'WEEKLY', triggerEvent: 'round.won.tie', targetCount: 5,
    rewardCoins: '5000', enabled: false, startsAt: null, endsAt: null, updatedAt: daysAgo(22),
  },
];

export const MOCK_ACHIEVEMENTS: AchievementConfig[] = [
  { id: 'ach_01', code: 'first_round', title: 'First round', description: 'Play your very first round.', tier: 'bronze', targetCount: 1, rewardCoins: '500', enabled: true, unlockedCount: 121_884 },
  { id: 'ach_02', code: 'century', title: 'Century', description: 'Play 100 rounds.', tier: 'silver', targetCount: 100, rewardCoins: '3000', enabled: true, unlockedCount: 42_119 },
  { id: 'ach_03', code: 'marathoner', title: 'Marathoner', description: 'Play 1,000 rounds.', tier: 'gold', targetCount: 1000, rewardCoins: '15000', enabled: true, unlockedCount: 6_402 },
  { id: 'ach_04', code: 'social_butterfly', title: 'Social butterfly', description: 'Refer ten friends who play a round.', tier: 'platinum', targetCount: 10, rewardCoins: '25000', enabled: true, unlockedCount: 812 },
  { id: 'ach_05', code: 'analyst', title: 'Analyst', description: 'Open the analytics screen 25 times.', tier: 'bronze', targetCount: 25, rewardCoins: '1000', enabled: false, unlockedCount: 18_330 },
];

export const MOCK_PROMO_CODES: PromoCode[] = [
  { id: 'prm_01', code: 'WELCOME2026', description: 'New player welcome bonus.', rewardCoins: '5000', maxRedemptions: null, redemptions: 24_881, perUserLimit: 1, startsAt: daysAgo(120), expiresAt: null, enabled: true, createdAt: daysAgo(120) },
  { id: 'prm_02', code: 'MONSOON500', description: 'Monsoon campaign top-up.', rewardCoins: '500', maxRedemptions: 50_000, redemptions: 31_204, perUserLimit: 1, startsAt: daysAgo(20), expiresAt: daysAgo(-10), enabled: true, createdAt: daysAgo(21) },
  { id: 'prm_03', code: 'COMEBACK', description: 'Win-back for players idle 30+ days.', rewardCoins: '2500', maxRedemptions: 10_000, redemptions: 9_988, perUserLimit: 1, startsAt: daysAgo(45), expiresAt: daysAgo(-2), enabled: true, createdAt: daysAgo(46) },
  { id: 'prm_04', code: 'DIWALI2025', description: 'Expired festival campaign.', rewardCoins: '3000', maxRedemptions: 100_000, redemptions: 88_412, perUserLimit: 1, startsAt: daysAgo(290), expiresAt: daysAgo(270), enabled: false, createdAt: daysAgo(295) },
];

/* ------------------------------------------------------------------ */
/* Tournaments                                                         */
/* ------------------------------------------------------------------ */

export const MOCK_TOURNAMENTS: TournamentSummary[] = [
  {
    id: 'trn_01', name: 'Weekend Cup · August', mode: 'TOURNAMENT', state: 'LIVE',
    startsAt: daysAgo(1), endsAt: daysAgo(-1),
    entryFee: '1000', prizePool: '500000',
    prizeTiers: [
      { fromRank: 1, toRank: 1, prize: '200000' },
      { fromRank: 2, toRank: 2, prize: '100000' },
      { fromRank: 3, toRank: 3, prize: '50000' },
      { fromRank: 4, toRank: 10, prize: '15000' },
      { fromRank: 11, toRank: 50, prize: '1125' },
    ],
    participants: 4_812, maxParticipants: 10_000,
    rules: 'Highest net coin gain across all Classic rounds played during the window. Practice rounds do not count.',
    createdAt: daysAgo(9),
  },
  {
    id: 'trn_02', name: 'Quick Fire Sprint', mode: 'QUICK', state: 'UPCOMING',
    startsAt: daysAgo(-3), endsAt: daysAgo(-2),
    entryFee: '500', prizePool: '150000',
    prizeTiers: [
      { fromRank: 1, toRank: 1, prize: '60000' },
      { fromRank: 2, toRank: 5, prize: '15000' },
      { fromRank: 6, toRank: 20, prize: '2000' },
    ],
    participants: 0, maxParticipants: 5_000,
    rules: 'Most rounds won in a two-hour window. Ties broken by earliest qualifying round.',
    createdAt: daysAgo(2),
  },
  {
    id: 'trn_03', name: 'Monsoon Masters', mode: 'CLASSIC', state: 'ENDED',
    startsAt: daysAgo(22), endsAt: daysAgo(20),
    entryFee: '2000', prizePool: '900000',
    prizeTiers: [
      { fromRank: 1, toRank: 1, prize: '400000' },
      { fromRank: 2, toRank: 3, prize: '150000' },
      { fromRank: 4, toRank: 25, prize: '9090' },
    ],
    participants: 7_331, maxParticipants: 8_000,
    rules: 'Highest net coin gain across the window.',
    createdAt: daysAgo(30),
  },
  {
    id: 'trn_04', name: 'Independence Special', mode: 'CLASSIC', state: 'DRAFT',
    startsAt: daysAgo(-6), endsAt: daysAgo(-5),
    entryFee: '0', prizePool: '250000',
    prizeTiers: [{ fromRank: 1, toRank: 100, prize: '2500' }],
    participants: 0, maxParticipants: null,
    rules: 'Free entry. Flat prize for the top 100 by rounds won.',
    createdAt: daysAgo(1),
  },
];

/* ------------------------------------------------------------------ */
/* Prediction models                                                   */
/* ------------------------------------------------------------------ */

export const MOCK_PREDICTION_MODELS: PredictionModelConfig[] = [
  {
    id: 'pmd_01', code: 'rolling_frequency', name: 'Rolling frequency',
    description: 'Counts outcomes over a rolling window and reports the observed frequency. No forecast is implied.',
    method: 'rolling_frequency', enabled: true, minDataRounds: 100,
    accuracy: 0.341, accuracyFloor: 0.3, sampleSize: 48_221,
    autoDisabled: false, autoDisabledAt: null, autoDisabledReason: null,
    lastUpdatedAt: minutesAgo(18),
  },
  {
    id: 'pmd_02', code: 'streak_length', name: 'Streak length',
    description: 'Reports how long the current run of one outcome has lasted, with the historical distribution of run lengths.',
    method: 'streak_distribution', enabled: true, minDataRounds: 250,
    accuracy: 0.336, accuracyFloor: 0.3, sampleSize: 31_004,
    autoDisabled: false, autoDisabledAt: null, autoDisabledReason: null,
    lastUpdatedAt: minutesAgo(18),
  },
  {
    id: 'pmd_03', code: 'markov_order1', name: 'First-order Markov',
    description: 'Transition frequencies between consecutive outcomes.',
    method: 'markov_order1', enabled: false, minDataRounds: 500,
    accuracy: 0.287, accuracyFloor: 0.3, sampleSize: 12_887,
    autoDisabled: true,
    autoDisabledAt: daysAgo(2),
    autoDisabledReason:
      'Measured accuracy 28.7% fell below the 30.0% floor over 12,887 scored predictions.',
    lastUpdatedAt: daysAgo(2),
  },
  {
    id: 'pmd_04', code: 'card_value_bias', name: 'Card value bias',
    description: 'Tracks the distribution of drawn card values against the uniform expectation.',
    method: 'value_distribution', enabled: true, minDataRounds: 1000,
    accuracy: null, accuracyFloor: 0.3, sampleSize: 640,
    autoDisabled: false, autoDisabledAt: null, autoDisabledReason: null,
    lastUpdatedAt: minutesAgo(18),
  },
];

/* ------------------------------------------------------------------ */
/* CMS                                                                 */
/* ------------------------------------------------------------------ */

const TERMS_BODY = `# Terms of Service

Zitto is a free-to-play social card game. Coins are virtual, have no cash
value, and cannot be exchanged for money or anything of value.

## Eligibility

You must be 18 or older to hold an account.

## Fair play

Every round is decided by a provably-fair draw. The server seed hash is
published before betting opens and the seed itself is released once the round
settles, so any player can verify the result independently.`;

export const MOCK_CMS_PAGES: CmsPageSummary[] = [
  { id: 'cms_01', slug: 'terms', locale: 'en', title: 'Terms of Service', body: TERMS_BODY, published: true, version: 7, updatedAt: daysAgo(14), updatedBy: 'Neha Kapoor' },
  { id: 'cms_02', slug: 'terms', locale: 'hi', title: 'सेवा की शर्तें', body: '# सेवा की शर्तें\n\nZitto एक निःशुल्क सोशल कार्ड गेम है। सिक्के आभासी हैं और उनका कोई नकद मूल्य नहीं है।', published: true, version: 5, updatedAt: daysAgo(14), updatedBy: 'Neha Kapoor' },
  { id: 'cms_03', slug: 'privacy', locale: 'en', title: 'Privacy Policy', body: '# Privacy Policy\n\nWe collect the minimum needed to run your account.', published: true, version: 4, updatedAt: daysAgo(38), updatedBy: 'Sameer Rao' },
  { id: 'cms_04', slug: 'privacy', locale: 'hi', title: 'गोपनीयता नीति', body: '# गोपनीयता नीति\n\nहम आपका खाता चलाने के लिए आवश्यक न्यूनतम जानकारी एकत्र करते हैं।', published: true, version: 3, updatedAt: daysAgo(38), updatedBy: 'Sameer Rao' },
  { id: 'cms_05', slug: 'responsible-play', locale: 'en', title: 'Responsible Play', body: '# Responsible Play\n\nSet a daily limit, take breaks, and use self-exclusion whenever you need it.', published: true, version: 2, updatedAt: daysAgo(60), updatedBy: 'Neha Kapoor' },
  { id: 'cms_06', slug: 'fairness', locale: 'en', title: 'How fairness works', body: '# How fairness works\n\nEach round commits to a server seed hash before betting opens.', published: false, version: 1, updatedAt: daysAgo(2), updatedBy: 'Rajkumar Vishwakarma' },
];

export const MOCK_BANNERS: BannerConfig[] = [
  { id: 'bnr_01', title: 'Weekend Cup is live', body: 'Join the August Weekend Cup before Sunday midnight.', locale: 'en', placement: 'home', ctaLabel: 'View tournament', ctaHref: '/tournaments/trn_01', startsAt: daysAgo(1), endsAt: daysAgo(-1), enabled: true },
  { id: 'bnr_02', title: 'Set a daily limit', body: 'Responsible play tools live in Settings.', locale: 'en', placement: 'global', ctaLabel: 'Open settings', ctaHref: '/settings', startsAt: daysAgo(90), endsAt: null, enabled: true },
  { id: 'bnr_03', title: 'नया दैनिक इनाम', body: 'हर दिन लॉग इन करें और सिक्के अर्जित करें।', locale: 'hi', placement: 'lobby', ctaLabel: null, ctaHref: null, startsAt: daysAgo(10), endsAt: daysAgo(-20), enabled: false },
];

/* ------------------------------------------------------------------ */
/* Feature flags                                                       */
/* ------------------------------------------------------------------ */

export const MOCK_FEATURE_FLAGS: FeatureFlag[] = [
  { id: 'flg_01', key: 'game.private_tables', name: 'Private tables', description: 'Lets players create invite-only tables.', enabled: false, rolloutPercent: 0, requiresComplianceSignOff: false, category: 'game', updatedAt: daysAgo(6), updatedBy: 'Sameer Rao' },
  { id: 'flg_02', key: 'social.friend_chat', name: 'Friend chat', description: 'Direct messages between friends.', enabled: true, rolloutPercent: 35, requiresComplianceSignOff: false, category: 'social', updatedAt: daysAgo(3), updatedBy: 'Neha Kapoor' },
  { id: 'flg_03', key: 'economy.coin_shop', name: 'Coin shop', description: 'Virtual coin bundles. Coins remain non-redeemable.', enabled: false, rolloutPercent: 0, requiresComplianceSignOff: false, category: 'economy', updatedAt: daysAgo(30), updatedBy: null },
  { id: 'flg_04', key: 'compliance.real_money_play', name: 'Real-money play', description: 'Enables wagering with real currency. Changes the legal classification of the product in every market.', enabled: false, rolloutPercent: 0, requiresComplianceSignOff: true, category: 'compliance', updatedAt: daysAgo(200), updatedBy: null },
  { id: 'flg_05', key: 'compliance.live_dealer', name: 'Live dealer tables', description: 'Streamed human dealer tables. Introduces broadcast, recording and licensing obligations.', enabled: false, rolloutPercent: 0, requiresComplianceSignOff: true, category: 'compliance', updatedAt: daysAgo(200), updatedBy: null },
  { id: 'flg_06', key: 'experimental.new_analytics_ui', name: 'New analytics UI', description: 'Rebuilt analytics screen for the player app.', enabled: true, rolloutPercent: 10, requiresComplianceSignOff: false, category: 'experimental', updatedAt: daysAgo(1), updatedBy: 'Rajkumar Vishwakarma' },
];

/* ------------------------------------------------------------------ */
/* Support tickets                                                     */
/* ------------------------------------------------------------------ */

const TICKET_SUBJECTS = [
  'Round did not settle',
  'Daily reward not credited',
  'Cannot verify my mobile number',
  'Another player is abusing chat',
  'Coins missing after a tournament',
  'Self-exclusion request',
  'App crashes on the results screen',
  'Promo code rejected',
];

const TICKET_CATEGORIES = ['Gameplay', 'Wallet', 'Account', 'Abuse', 'Technical', 'Responsible play'];

function buildTickets(count: number): SupportTicket[] {
  const rng = createRng(8899);
  const statuses: TicketStatus[] = ['open', 'open', 'pending', 'resolved', 'closed'];
  const priorities: TicketPriority[] = ['low', 'normal', 'normal', 'high', 'urgent'];

  return Array.from({ length: count }, (_, index) => {
    const user = MOCK_USERS[index % MOCK_USERS.length];
    const status = pick(statuses, rng);
    const assigned = rng() > 0.4;
    const subject = pick(TICKET_SUBJECTS, rng);

    return {
      id: `tkt_${(600000 - index).toString(36)}`,
      reference: `ZT-${(41200 - index).toString()}`,
      subject,
      category: pick(TICKET_CATEGORIES, rng),
      status,
      priority: pick(priorities, rng),
      userId: user?.id ?? 'usr_unknown',
      userDisplayName: user?.displayName ?? 'Unknown player',
      assigneeId: assigned ? `adm_${hex(6, rng)}` : null,
      assigneeName: assigned ? pick(ADMIN_NAMES.slice(0, 3), rng) : null,
      messages: [
        {
          id: `msg_${hex(8, rng)}`,
          authorName: user?.displayName ?? 'Unknown player',
          authorType: 'user' as const,
          body: `${subject}. This happened around ${intBetween(1, 11, rng)} hours ago on Classic Table ${intBetween(1, 2, rng)}.`,
          createdAt: minutesAgo(index * 23 + 90),
        },
        ...(status === 'resolved' || status === 'closed'
          ? [
              {
                id: `msg_${hex(8, rng)}`,
                authorName: pick(ADMIN_NAMES.slice(0, 3), rng),
                authorType: 'admin' as const,
                body: 'Checked the round record and the ledger. Everything settled correctly — sending you the reference now.',
                createdAt: minutesAgo(index * 23 + 30),
              },
            ]
          : []),
      ],
      createdAt: minutesAgo(index * 23 + 90),
      updatedAt: minutesAgo(index * 23 + 20),
      firstResponseAt: assigned ? minutesAgo(index * 23 + 60) : null,
    };
  });
}

export const MOCK_TICKETS: SupportTicket[] = buildTickets(64);

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

const REPORT_REASONS = [
  'Abusive language in chat',
  'Suspected multi-accounting',
  'Spam links in chat',
  'Harassment after a round',
  'Impersonating a moderator',
];

export const MOCK_REPORTS: Report[] = Array.from({ length: 38 }, (_, index) => {
  const rng = createRng(1000 + index);
  const reporter = MOCK_USERS[(index * 3) % MOCK_USERS.length];
  const reported = MOCK_USERS[(index * 7 + 5) % MOCK_USERS.length];
  const status = pick(['open', 'open', 'reviewing', 'resolved', 'dismissed'] as const, rng);
  const closed = status === 'resolved' || status === 'dismissed';

  return {
    id: `rpt_${(500000 - index).toString(36)}`,
    reporterId: reporter?.id ?? 'usr_unknown',
    reporterName: reporter?.displayName ?? 'Unknown player',
    reportedUserId: reported?.id ?? 'usr_unknown',
    reportedUserName: reported?.displayName ?? 'Unknown player',
    reason: pick(REPORT_REASONS, rng),
    details:
      'Reported from the in-round chat panel. The player repeated the same message across four consecutive rounds.',
    status,
    resolution: closed
      ? status === 'resolved'
        ? 'Chat ban applied for 7 days. Reporter notified.'
        : 'No policy breach found in the chat transcript.'
      : null,
    reviewedBy: closed ? pick(ADMIN_NAMES.slice(0, 3), rng) : null,
    reviewedAt: closed ? minutesAgo(index * 40 + 60) : null,
    createdAt: minutesAgo(index * 40 + 200),
  };
});

export function reportsForUser(userId: string): Report[] {
  return MOCK_REPORTS.filter((report) => report.reportedUserId === userId).slice(0, 5);
}
