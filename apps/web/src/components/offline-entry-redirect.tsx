'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Sends the packaged app past the landing page.
 *
 * Capacitor opens `index.html`, which is the marketing page — the right first
 * screen for someone who arrived from a search result, and the wrong one for
 * someone who already installed the app and wants to play. On the web this
 * renders nothing and the landing page behaves normally.
 */
export function OfflineEntryRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_OFFLINE === '1') {
      router.replace('/home');
    }
  }, [router]);

  return null;
}
