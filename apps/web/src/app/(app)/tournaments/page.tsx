'use client';

import { useMemo, useState } from 'react';
import { Clock, Trophy, Users } from 'lucide-react';

import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
// MOCK: replace with GET /tournaments?status=
import { mockTournaments } from '@/lib/mock-data';
import { formatCoins, formatRelativeTime } from '@/lib/utils';
import type { TournamentState } from '@/types';

const TABS = [
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ended', label: 'Ended' },
] as const;

type Tab = (typeof TABS)[number]['key'];

/**
 * Four server states collapse into three tabs — a cancelled tournament is over
 * as far as a player is concerned, so it files under "Ended".
 */
const STATE_TAB: Record<TournamentState, Tab> = {
  live: 'live',
  upcoming: 'upcoming',
  ended: 'ended',
  cancelled: 'ended',
};

export default function TournamentsPage() {
  const [tab, setTab] = useState<Tab>('live');

  const shown = useMemo(
    () => mockTournaments.filter((t) => STATE_TAB[t.state] === tab),
    [tab],
  );

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold">
          <Trophy className="h-5 w-5 text-gold-500" />
          Tournaments
        </h1>
        <p className="mt-1 text-xs text-surface-muted">
          Entry fees and prizes are in virtual coins only.
        </p>
      </PageSection>

      <PageSection>
        <div role="tablist" aria-label="Tournament status" className="flex gap-2">
          {TABS.map((t) => (
            <Button
              key={t.key}
              role="tab"
              size="sm"
              aria-selected={tab === t.key}
              variant={tab === t.key ? 'primary' : 'outline'}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </PageSection>

      <PageSection>
        {shown.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-8 w-8" />}
            title={`No ${tab} tournaments`}
            description={
              tab === 'live'
                ? 'Check the Upcoming tab for what starts next.'
                : 'Nothing to show here right now.'
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {shown.map((t) => (
              <Card key={t.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{t.name}</p>
                      <p className="mt-0.5 text-xs text-surface-muted">{t.description}</p>
                    </div>
                    <Badge variant={t.state === 'live' ? 'success' : 'outline'}>
                      {t.state === 'live' ? 'Live' : t.state === 'upcoming' ? 'Soon' : 'Ended'}
                    </Badge>
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <dt className="text-[11px] text-surface-muted">Prize pool</dt>
                      <dd className="text-sm font-bold tabular-nums text-gold-400">
                        {formatCoins(t.prizePool)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-surface-muted">Entry</dt>
                      <dd className="text-sm font-bold tabular-nums">
                        {t.entryFee === 0 ? 'Free' : formatCoins(t.entryFee)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-surface-muted">Players</dt>
                      <dd className="flex items-center justify-center gap-1 text-sm font-bold tabular-nums">
                        <Users className="h-3 w-3 text-surface-muted" aria-hidden="true" />
                        {t.playerCount}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1 text-xs text-surface-muted">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {t.state === 'ended'
                        ? `Ended ${formatRelativeTime(t.endsAt)}`
                        : t.state === 'live'
                          ? `Ends ${formatRelativeTime(t.endsAt)}`
                          : `Starts ${formatRelativeTime(t.startsAt)}`}
                    </span>
                    {t.state !== 'ended' && (
                      <Button size="sm">{t.joined ? 'View' : 'Join'}</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageSection>
    </PageContainer>
  );
}
