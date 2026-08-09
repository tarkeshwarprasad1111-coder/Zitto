'use client';

import { ChevronRight, Gauge, GraduationCap, Spade, Trophy, Users } from 'lucide-react';
import Link from 'next/link';

import { PageContainer } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
// MOCK: room list. Replace with `GET /game/rooms`.
import { mockRooms } from '@/lib/mock-data';
import { cn, formatCoins } from '@/lib/utils';
import type { GameMode } from '@/types';

const MODE_META: Record<
  GameMode,
  { icon: typeof Spade; description: string; accent: string; badge?: string }
> = {
  classic: {
    icon: Spade,
    description: 'The standard table. A 20-second betting window each round.',
    accent: 'bg-dragon-500/15 text-dragon-300',
  },
  quick: {
    icon: Gauge,
    description: 'Faster rounds with a 10-second window. More hands per session.',
    accent: 'bg-tiger-500/15 text-tiger-300',
  },
  practice: {
    icon: GraduationCap,
    description: 'Lower stakes and a longer window. Good for learning the flow.',
    accent: 'bg-surface-elevated text-surface-subtle',
    badge: 'No entry cost',
  },
  tournament: {
    icon: Trophy,
    description: 'Play for leaderboard position in an active event.',
    accent: 'bg-gold-500/15 text-gold-300',
    badge: 'Live',
  },
  private: {
    icon: Users,
    description: 'A table you share by invite code.',
    accent: 'bg-surface-elevated text-surface-subtle',
  },
  public: {
    icon: Users,
    description: 'An open table anyone can join.',
    accent: 'bg-surface-elevated text-surface-subtle',
  },
};

const MODE_LABELS: Record<GameMode, string> = {
  classic: 'Classic',
  quick: 'Quick Draw',
  practice: 'Practice',
  tournament: 'Tournament',
  private: 'Private',
  public: 'Public',
};

export default function GameModesPage() {
  return (
    <PageContainer className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl font-bold">Choose a table</h1>
        <p className="mt-1 text-sm text-surface-muted">
          Same rules everywhere — only the pace and the limits change.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {mockRooms.map((room) => {
          const meta = MODE_META[room.mode];
          const Icon = meta.icon;
          const isOpen = room.status === 'open';

          return (
            <li key={room.id}>
              <Link href={`/game/${room.id}`} aria-disabled={!isOpen}>
                <Card interactive={isOpen} className={cn('p-4', !isOpen && 'opacity-60')}>
                  <div className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                        meta.accent,
                      )}
                    >
                      <Icon size={22} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base font-semibold">{room.name}</h2>
                        <Badge variant="outline" size="sm">
                          {MODE_LABELS[room.mode]}
                        </Badge>
                        {meta.badge ? (
                          <Badge variant={room.mode === 'tournament' ? 'gold' : 'default'} size="sm">
                            {meta.badge}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm leading-relaxed text-surface-muted">
                        {meta.description}
                      </p>

                      <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <div className="flex items-baseline gap-1">
                          <dt className="text-surface-muted">Players</dt>
                          <dd className="font-medium tabular-nums text-surface-subtle">
                            {room.playerCount.toLocaleString('en-IN')}
                          </dd>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <dt className="text-surface-muted">Bet range</dt>
                          <dd className="font-medium tabular-nums text-surface-subtle">
                            {formatCoins(room.minBet)}–{formatCoins(room.maxBet)}
                          </dd>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <dt className="text-surface-muted">Window</dt>
                          <dd className="font-medium tabular-nums text-surface-subtle">
                            {Math.round(room.bettingDurationMs / 1000)}s
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <ChevronRight
                      size={18}
                      aria-hidden="true"
                      className="mt-1 shrink-0 text-surface-muted"
                    />
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-center text-xs leading-relaxed text-surface-muted">
        All tables use virtual coins with no cash value. Every round is independent of the last.
      </p>
    </PageContainer>
  );
}
