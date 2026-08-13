'use client';

import { Bell, Coins } from 'lucide-react';
import Link from 'next/link';

import { cn, formatCoins } from '@/lib/utils';
import type { Coins as CoinsType } from '@/types';

export interface TopBarProps {
  balance: CoinsType;
  unreadNotifications?: number;
  className?: string;
}

/** Zitto wordmark with the dragon/tiger split. */
export function ZittoLogo({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-lg font-extrabold tracking-tight', className)}>
      <span className="text-dragon-500">Z</span>
      <span className="text-surface-fg">itt</span>
      <span className="text-tiger-500">o</span>
    </span>
  );
}

export function TopBar({ balance, unreadNotifications = 0, className }: TopBarProps) {
  const badgeCount = unreadNotifications > 9 ? '9+' : String(unreadNotifications);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-surface-border bg-surface-bg/85 pt-safe backdrop-blur-lg',
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-2 px-3">
        <Link
          href="/home"
          className="flex items-center rounded-lg px-1 py-1 focus-visible:ring-2 focus-visible:ring-gold-400"
          aria-label="Zitto home"
        >
          <ZittoLogo />
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            href="/wallet"
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1.5 transition-colors hover:bg-gold-500/18 focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            <Coins size={15} aria-hidden="true" className="text-gold-400" />
            <span className="text-sm font-semibold tabular-nums text-gold-300">
              {formatCoins(balance, { compact: true })}
            </span>
            <span className="sr-only">virtual coins. Open wallet.</span>
          </Link>

          <Link
            href="/notifications"
            aria-label={
              unreadNotifications > 0
                ? `Notifications, ${unreadNotifications} unread`
                : 'Notifications'
            }
            className="relative flex h-11 w-11 items-center justify-center rounded-xl text-surface-muted transition-colors hover:bg-surface-elevated hover:text-surface-fg focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            <Bell size={20} aria-hidden="true" />
            {unreadNotifications > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-dragon-600 px-1 text-[10px] font-bold leading-none text-white"
              >
                {badgeCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
