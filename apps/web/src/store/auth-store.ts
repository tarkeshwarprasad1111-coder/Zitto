'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { registerAuthTokenGetter, registerUnauthorizedHandler } from '@/lib/api';
import type { AuthTokens, User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Epoch ms at which `accessToken` expires. */
  expiresAt: number | null;
  isAuthenticated: boolean;
  /** False until the persisted session has been rehydrated from storage. */
  isHydrated: boolean;

  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setTokens: (tokens: AuthTokens) => void;
  setHydrated: (value: boolean) => void;
  /** True when the access token is missing or past its expiry. */
  isTokenExpired: () => boolean;
}

const emptySession = {
  user: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  isAuthenticated: false,
} satisfies Pick<
  AuthState,
  'user' | 'accessToken' | 'refreshToken' | 'expiresAt' | 'isAuthenticated'
>;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...emptySession,
      isHydrated: false,

      login: (user, tokens) =>
        set({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
          isAuthenticated: true,
        }),

      logout: () => set({ ...emptySession }),

      setUser: (user) => set({ user }),

      setTokens: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
          isAuthenticated: true,
        }),

      setHydrated: (value) => set({ isHydrated: value }),

      isTokenExpired: () => {
        const { accessToken, expiresAt } = get();
        if (!accessToken || !expiresAt) return true;
        // 5s of slack so a request in flight doesn't land just after expiry.
        return Date.now() >= expiresAt - 5_000;
      },
    }),
    {
      name: 'zitto.auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

// Storage may already have been read before this module finished evaluating
// (or be unavailable, e.g. SSR) — settle `isHydrated` either way.
if (useAuthStore.persist.hasHydrated()) {
  useAuthStore.getState().setHydrated(true);
}

/* ------------------------------------------------------------------ */
/* Wire the API client to this store                                   */
/* ------------------------------------------------------------------ */

registerAuthTokenGetter(() => useAuthStore.getState().accessToken);
registerUnauthorizedHandler(() => {
  // A rejected token means the session is gone — drop it so the route guard
  // can bounce the player to /login rather than looping on 401s.
  useAuthStore.getState().logout();
});

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

export const selectUser = (state: AuthState): User | null => state.user;
export const selectIsAuthenticated = (state: AuthState): boolean => state.isAuthenticated;
export const selectIsHydrated = (state: AuthState): boolean => state.isHydrated;
