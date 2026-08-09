'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Persistent notice shown whenever the browser reports no connection.
 *
 * The game is server-authoritative, so an offline client cannot place or
 * settle a selection — telling the player immediately avoids them tapping
 * Confirm into a void.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // navigator.onLine is only meaningful on the client; read it after mount
    // so server and first client render agree.
    setIsOffline(!navigator.onLine);

    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline ? (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-warning-500 px-4 py-2 pt-safe text-sm font-medium text-surface-bg"
        >
          <WifiOff size={16} aria-hidden="true" />
          <span>No connection. Live rounds are paused until you are back online.</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
