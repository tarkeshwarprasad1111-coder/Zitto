import { QueryClient, type DefaultOptions } from '@tanstack/react-query';

import { AdminApiError } from '@/lib/api';

const defaultOptions: DefaultOptions = {
  queries: {
    // Console data is operational: 20s keeps navigation instant without
    // showing a stale ticket queue during an incident.
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      if (error instanceof AdminApiError) {
        // A rejected credential or a permission failure will not fix itself.
        if (!error.isRetryable) return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8_000),
  },
  mutations: {
    // Admin mutations suspend accounts and move coins. Retrying without an
    // idempotency key risks doubling the effect, so callers opt in explicitly.
    retry: false,
  },
};

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions });
}

/** Filter bag shared by list queries. Part of the cache key, so keep it flat. */
export type QueryFilters = Record<string, unknown>;

/**
 * Query key factory. Centralising keys keeps invalidation honest — suspending
 * a user can invalidate `users`, `auditLogs` and `dashboard` without guessing
 * at string literals.
 */
export const queryKeys = {
  session: ['admin', 'session'] as const,

  dashboard: ['dashboard'] as const,
  systemHealth: ['dashboard', 'health'] as const,

  users: (filters?: QueryFilters) => ['users', filters ?? {}] as const,
  user: (id: string) => ['users', id] as const,
  userLedger: (id: string, filters?: QueryFilters) =>
    ['users', id, 'ledger', filters ?? {}] as const,
  userRounds: (id: string, filters?: QueryFilters) =>
    ['users', id, 'rounds', filters ?? {}] as const,
  userSessions: (id: string) => ['users', id, 'sessions'] as const,
  userNotes: (id: string) => ['users', id, 'notes'] as const,
  userReports: (id: string) => ['users', id, 'reports'] as const,

  rounds: (filters?: QueryFilters) => ['rounds', filters ?? {}] as const,
  round: (id: string) => ['rounds', id] as const,

  gameConfig: ['game', 'config'] as const,

  ledger: (filters?: QueryFilters) => ['ledger', filters ?? {}] as const,
  reconciliation: ['ledger', 'reconciliation'] as const,

  dailyRewards: ['rewards', 'daily'] as const,
  missions: ['rewards', 'missions'] as const,
  achievements: ['rewards', 'achievements'] as const,
  promoCodes: ['rewards', 'promo-codes'] as const,

  tournaments: (filters?: QueryFilters) => ['tournaments', filters ?? {}] as const,

  predictionModels: ['prediction-models'] as const,

  cmsPages: (filters?: QueryFilters) => ['cms', 'pages', filters ?? {}] as const,
  banners: ['cms', 'banners'] as const,

  auditLogs: (filters?: QueryFilters) => ['audit-logs', filters ?? {}] as const,

  featureFlags: ['feature-flags'] as const,

  tickets: (filters?: QueryFilters) => ['tickets', filters ?? {}] as const,
  ticket: (id: string) => ['tickets', id] as const,

  reports: (filters?: QueryFilters) => ['reports', filters ?? {}] as const,
} as const;
