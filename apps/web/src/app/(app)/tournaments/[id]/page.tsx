'use client';

import { ArrowLeft, Clock, Trophy, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';

import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { mockTournaments } from '@/lib/mock-data';
import { formatCoins, formatRelativeTime } from '@/lib/utils';

/** Prize split by finishing position. Percentages of the pool. */
const PRIZE_SPLIT = [
  { place: '1st', share: 0.4 },
  { place: '2nd', share: 0.2 },
  { place: '3rd', share: 0.12 },
  { place: '4th – 10th', share: 0.28 },
] as const;

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const tournament = mockTournaments.find((t) => t.id === params.id);
  if (!tournament) notFound();

  const isOver = tournament.state === 'ended' || tournament.state === 'cancelled';
  const isLive = tournament.state === 'live';

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-1.5 text-sm text-surface-muted hover:text-surface-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All tournaments
        </Link>
      </PageSection>

      <PageSection>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold">{tournament.name}</h1>
            <p className="mt-1 text-sm text-surface-muted">{tournament.description}</p>
          </div>
          <Badge variant={isLive ? 'success' : isOver ? 'outline' : 'gold'}>
            {isLive ? 'Live' : isOver ? 'Ended' : 'Upcoming'}
          </Badge>
        </div>
      </PageSection>

      <PageSection>
        <Card>
          <CardContent className="py-4">
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-2xs text-surface-muted">Prize pool</dt>
                <dd className="mt-0.5 font-display text-lg font-bold tabular-nums text-gold-400">
                  {formatCoins(tournament.prizePool, { compact: true })}
                </dd>
              </div>
              <div>
                <dt className="text-2xs text-surface-muted">Entry</dt>
                <dd className="mt-0.5 font-display text-lg font-bold tabular-nums">
                  {tournament.entryFee === 0 ? 'Free' : formatCoins(tournament.entryFee)}
                </dd>
              </div>
              <div>
                <dt className="text-2xs text-surface-muted">Players</dt>
                <dd className="mt-0.5 flex items-center justify-center gap-1 font-display text-lg font-bold tabular-nums">
                  <Users className="h-3.5 w-3.5 text-surface-muted" aria-hidden="true" />
                  {tournament.playerCount.toLocaleString('en-IN')}
                </dd>
              </div>
            </dl>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-surface-muted">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {isOver
                ? `Ended ${formatRelativeTime(tournament.endsAt)}`
                : isLive
                  ? `Ends ${formatRelativeTime(tournament.endsAt)}`
                  : `Starts ${formatRelativeTime(tournament.startsAt)}`}
            </p>
          </CardContent>
        </Card>
      </PageSection>

      {tournament.joined && tournament.yourRank !== null ? (
        <PageSection>
          <Card className="border-gold-500/30 bg-gold-500/5">
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold">Your position</p>
                <p className="text-xs text-surface-muted">
                  {tournament.yourScore?.toLocaleString('en-IN') ?? 0} points
                </p>
              </div>
              <p className="font-display text-2xl font-bold tabular-nums text-gold-400">
                #{tournament.yourRank}
              </p>
            </CardContent>
          </Card>
        </PageSection>
      ) : null}

      <PageSection>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-subtle">
          <Trophy className="h-4 w-4 text-gold-400" aria-hidden="true" />
          Prize split
        </h2>
        <Card>
          <CardContent className="py-2">
            <ul>
              {PRIZE_SPLIT.map((tier) => (
                <li
                  key={tier.place}
                  className="flex items-center justify-between border-b border-surface-border py-2.5 last:border-0"
                >
                  <span className="text-sm">{tier.place}</span>
                  <span className="text-sm font-semibold tabular-nums text-gold-400">
                    {formatCoins(Math.round(tournament.prizePool * tier.share), { compact: true })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </PageSection>

      <PageSection>
        <h2 className="mb-2 text-sm font-semibold text-surface-subtle">Rules</h2>
        <Card>
          <CardContent className="py-3">
            <ul className="flex flex-col gap-2 text-sm text-surface-muted">
              <li>Standard Dragon Tiger. Higher card wins; equal ranks are a tie.</li>
              <li>One point per coin won. Losing rounds do not subtract points.</li>
              <li>Ties on the leaderboard are broken by whoever reached the score first.</li>
              <li>Entry fees and prizes are virtual coins with no cash value.</li>
            </ul>
          </CardContent>
        </Card>
      </PageSection>

      {!isOver ? (
        <PageSection>
          <Button className="w-full" size="lg">
            {tournament.joined ? 'Go to table' : `Join for ${tournament.entryFee === 0 ? 'free' : formatCoins(tournament.entryFee)}`}
          </Button>
        </PageSection>
      ) : null}
    </PageContainer>
  );
}
