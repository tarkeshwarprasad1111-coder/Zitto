'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { BottomNav } from '@/components/layout/bottom-nav';
import { TopBar } from '@/components/layout/top-bar';
import { Spinner } from '@/components/ui/spinner';
// MOCK: notification counts come from `GET /notifications` once the API is
// wired. The balance is real local state — playing a round moves it.
import { mockUnreadNotificationCount } from '@/lib/mock-data';
import { useAuthStore } from '@/store/auth-store';
import { useGameStore } from '@/store/game-store';

/** Routes inside the app shell that a guest may still open. */
const GUEST_ALLOWED = ['/game/practice-01'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const balance = useGameStore((state) => state.balance);

  const isGuestAllowed = GUEST_ALLOWED.some((route) => pathname.startsWith(route));

  useEffect(() => {
    // Wait for the persisted session to load before deciding — redirecting
    // on the first render would bounce every returning player to /login.
    if (!isHydrated) return;
    if (!isAuthenticated && !isGuestAllowed) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isHydrated, isAuthenticated, isGuestAllowed, pathname, router]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner size="lg" className="text-gold-400" label="Loading your session" />
      </div>
    );
  }

  if (!isAuthenticated && !isGuestAllowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner size="lg" className="text-gold-400" label="Redirecting to login" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar balance={balance} unreadNotifications={mockUnreadNotificationCount} />
      <div id="main-content" className="flex-1">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
