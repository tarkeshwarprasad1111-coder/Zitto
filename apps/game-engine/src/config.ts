import 'dotenv/config';

function int(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  fairnessKey: process.env.FAIRNESS_SIGNING_KEY ?? 'dev-only-fairness-key',
  phases: {
    bettingMs: int('GAME_ROUND_BETTING_MS', 20_000),
    drawingMs: int('GAME_ROUND_DRAWING_MS', 6_000),
    resultMs: int('GAME_ROUND_RESULT_MS', 4_000),
  },
  /** Guards against two engine replicas settling the same round. */
  lockTtlMs: int('GAME_ENGINE_LOCK_TTL_MS', 15_000),
  tickIntervalMs: int('GAME_ENGINE_TICK_MS', 500),
} as const;

export const ROUND_CYCLE_MS =
  config.phases.bettingMs + config.phases.drawingMs + config.phases.resultMs;
