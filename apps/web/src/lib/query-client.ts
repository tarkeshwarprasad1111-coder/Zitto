import { QueryClient, type DefaultOptions } from '@tanstack/react-query';

import { ApiError } from '@/lib/api';

const defaultOptions: DefaultOptions = {
  queries: {
    // Game and analytics data ages fast; 30s keeps navigation snappy without
    // showing a stale coin balance.
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      if (error instanceof ApiError) {
        // Never retry a rejected credential or a validation failure.
        if (!error.isRetryable) return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8_000),
  },
  mutations: {
    // Mutations move coins. Retrying without an idempotency key risks a
    // double debit, so callers opt in explicitly instead.
    retry: false,
  },
};

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions });
}

/**
 * Query key factory. Centralising keys keeps invalidation honest — settling
 * a round can invalidate `wallet` and `analytics` without guessing strings.
 */
export const queryKeys = {
  me: ['me'] as const,
  preferences: ['me', 'preferences'] as const,

  wallet: ['wallet'] as const,
  ledger: (filters?: Record<string, unknown>) => ['wallet', 'ledger', filters ?? {}] as const,

  gameConfig: ['game', 'config'] as const,
  rooms: (mode?: string) => ['game', 'rooms', mode ?? 'all'] as const,
  currentRound: (roomId: string) => ['game', 'rooms', roomId, 'current-round'] as const,
  round: (roundId: string) => ['game', 'rounds', roundId] as const,
  gameHistory: (filters?: Record<string, unknown>) => ['game', 'history', filters ?? {}] as const,

  analyticsSummary: (window: number) => ['analytics', 'summary', window] as const,
  analyticsTrends: (filters?: Record<string, unknown>) =>
    ['analytics', 'trends', filters ?? {}] as const,
  analyticsStreaks: (window: number) => ['analytics', 'streaks', window] as const,
  prediction: (roomId?: string) => ['analytics', 'prediction', roomId ?? 'global'] as const,
  modelStatus: (code?: string) => ['analytics', 'model-status', code ?? 'default'] as const,

  dailyReward: ['rewards', 'daily'] as const,
  missions: ['rewards', 'missions'] as const,
  achievements: ['rewards', 'achievements'] as const,

  tournaments: (status?: string) => ['tournaments', status ?? 'all'] as const,
  tournament: (id: string) => ['tournaments', id] as const,
  leaderboard: (id: string) => ['tournaments', id, 'leaderboard'] as const,

  notifications: ['notifications'] as const,
} as const;
