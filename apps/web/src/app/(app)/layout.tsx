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

/** True in the packaged Android build, which ships without a backend. */
const IS_OFFLINE_BUILD = process.env.NEXT_PUBLIC_OFFLINE === '1';

/** Routes inside the app shell that a guest may still open. */
const GUEST_ALLOWED = ['/game/practice-01'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const signInLocally = useAuthStore((state) => state.signInLocally);
  const balance = useGameStore((state) => state.balance);

  const isGuestAllowed = GUEST_ALLOWED.some((route) => pathname.startsWith(route));

  useEffect(() => {
    // Wait for the persisted session to load before deciding — redirecting
    // on the first render would bounce every returning player to /login.
    if (!isHydrated) return;
    if (isAuthenticated || isGuestAllowed) return;

    // The packaged build has no server to authenticate against, so sending a
    // first-time player to /login strands them: no account can be created and
    // no code can arrive. Let them in and start playing.
    if (IS_OFFLINE_BUILD) {
      signInLocally();
      return;
    }

    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isHydrated, isAuthenticated, isGuestAllowed, pathname, router, signInLocally]);

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
        <Spinner size="lg" className="text-gold-400" label="Signing you in" />
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
