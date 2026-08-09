'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { registerAuthTokenGetter, registerUnauthorizedHandler } from '@/lib/api';
import type { AdminRole, AdminUser, AuthTokens } from '@/types';

/** Ordered least → most privileged. Used by {@link AdminAuthState.hasRole}. */
const ROLE_RANK: Record<AdminRole, number> = {
  moderator: 1,
  admin: 2,
  super_admin: 3,
};

interface AdminAuthState {
  adminUser: AdminUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Epoch ms at which `accessToken` expires. */
  expiresAt: number | null;
  roles: AdminRole[];
  isAuthenticated: boolean;
  /** False until the persisted session has been rehydrated from storage. */
  isHydrated: boolean;

  /**
   * True when the admin holds `role` or anything more privileged.
   *
   * `super_admin` therefore satisfies `hasRole('admin')` — a super admin can
   * always do what an admin can, and the reverse is never true.
   */
  hasRole: (role: AdminRole) => boolean;
  /** Exact-match check, for UI that must distinguish the tiers. */
  hasExactRole: (role: AdminRole) => boolean;
  /** Fine-grained permission check, e.g. `hasPermission('rounds.void')`. */
  hasPermission: (permission: string) => boolean;
  isTokenExpired: () => boolean;

  login: (adminUser: AdminUser, tokens: AuthTokens) => void;
  logout: () => void;
  setAdminUser: (adminUser: AdminUser) => void;
  setTokens: (tokens: AuthTokens) => void;
  setHydrated: (value: boolean) => void;
}

const emptySession = {
  adminUser: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  roles: [],
  isAuthenticated: false,
} satisfies Pick<
  AdminAuthState,
  'adminUser' | 'accessToken' | 'refreshToken' | 'expiresAt' | 'roles' | 'isAuthenticated'
>;

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      ...emptySession,
      isHydrated: false,

      hasRole: (role) => {
        const { roles } = get();
        const required = ROLE_RANK[role];
        return roles.some((held) => (ROLE_RANK[held] ?? 0) >= required);
      },

      hasExactRole: (role) => get().roles.includes(role),

      hasPermission: (permission) => {
        const { adminUser, roles } = get();
        // A super admin implicitly holds every permission; the API enforces the
        // same rule, this is only so the UI does not hide its own controls.
        if (roles.includes('super_admin')) return true;
        return adminUser?.permissions.includes(permission) ?? false;
      },

      isTokenExpired: () => {
        const { accessToken, expiresAt } = get();
        if (!accessToken || !expiresAt) return true;
        // 5s of slack so a request in flight does not land just after expiry.
        return Date.now() >= expiresAt - 5_000;
      },

      login: (adminUser, tokens) =>
        set({
          adminUser,
          roles: adminUser.roles,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
          isAuthenticated: true,
        }),

      logout: () => set({ ...emptySession }),

      setAdminUser: (adminUser) => set({ adminUser, roles: adminUser.roles }),

      setTokens: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
          isAuthenticated: true,
        }),

      setHydrated: (value) => set({ isHydrated: value }),
    }),
    {
      name: 'zitto.admin.auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        adminUser: state.adminUser,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        roles: state.roles,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

// Storage may already have been read before this module finished evaluating
// (or be unavailable, e.g. during SSR) — settle `isHydrated` either way.
if (useAdminAuthStore.persist.hasHydrated()) {
  useAdminAuthStore.getState().setHydrated(true);
}

/* ------------------------------------------------------------------ */
/* Wire the API client to this store                                   */
/* ------------------------------------------------------------------ */

registerAuthTokenGetter(() => useAdminAuthStore.getState().accessToken);
registerUnauthorizedHandler(() => {
  // A rejected token means the session is gone — drop it so RequireRole can
  // bounce to /login rather than looping on 401s.
  useAdminAuthStore.getState().logout();
});

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

export const selectAdminUser = (state: AdminAuthState): AdminUser | null => state.adminUser;
export const selectRoles = (state: AdminAuthState): AdminRole[] => state.roles;
export const selectIsAuthenticated = (state: AdminAuthState): boolean => state.isAuthenticated;
export const selectIsHydrated = (state: AdminAuthState): boolean => state.isHydrated;

/** Human label for a role badge. */
export const ROLE_LABEL: Record<AdminRole, string> = {
  moderator: 'Moderator',
  admin: 'Admin',
  super_admin: 'Super admin',
};

/** Highest-ranked role held, for the topbar badge. */
export function primaryRole(roles: AdminRole[]): AdminRole | null {
  let best: AdminRole | null = null;
  for (const role of roles) {
    if (best === null || (ROLE_RANK[role] ?? 0) > (ROLE_RANK[best] ?? 0)) {
      best = role;
    }
  }
  return best;
}
