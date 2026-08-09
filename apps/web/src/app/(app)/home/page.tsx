'use client';

import {
  BarChart3,
  ChevronRight,
  Coins,
  Gift,
  Play,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';

import { RoundHistoryStrip } from '@/components/game/round-history-strip';
import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
// MOCK: every figure below is fixture data. Replace with TanStack Query calls
// to /wallet, /rewards/*, /tournaments and /game/history.
import {
  mockDailyReward,
  mockMissions,
  mockOutcomeHistory,
  mockTournament,
  mockWallet,
} from '@/lib/mock-data';
import { cn, formatCoins, formatRelativeTime, greetingKey } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

const GREETINGS = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
} as const;

export default function HomePage() {
  const user = useAuthStore((state) => state.user);
  const { toast } = useToast();

  const greeting = GREETINGS[greetingKey()];
  const previewMissions = mockMissions.slice(0, 2);

  return (
    <PageContainer className="flex flex-col gap-6">
      {/* Greeting */}
      <header>
        <p className="text-sm text-surface-muted">{greeting}</p>
        <h1 className="font-display text-2xl font-bold">{user?.displayName ?? 'Player'}</h1>
      </header>

      {/* Balance */}
      <Card variant="glass" className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-surface-muted">
              Your balance
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <Coins size={22} aria-hidden="true" className="text-gold-400" />
              <span className="font-sans text-4xl font-bold leading-none text-gold-300">
                {formatCoins(mockWallet.balance)}
              </span>
            </p>
            {mockWallet.bonus > 0 ? (
              <Badge variant="gold" size="sm" className="mt-2">
                +{formatCoins(mockWallet.bonus)} bonus
              </Badge>
            ) : null}
          </div>
        </div>

        <p className="mt-3 text-2xs text-surface-muted">
          Virtual coins. No cash value, and not exchangeable for money.
        </p>

        <div className="mt-4 flex gap-2.5">
          <Link href="/game" className="flex-1">
            <Button variant="primary" size="lg" fullWidth leftIcon={<Play size={17} />}>
              Play now
            </Button>
          </Link>
          <Link href="/analytics" className="flex-1">
            <Button variant="outline" size="lg" fullWidth leftIcon={<BarChart3 size={17} />}>
              Analytics
            </Button>
          </Link>
        </div>
      </Card>

      {/* Daily reward */}
      <Card className="flex items-center gap-4 p-4">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-400"
        >
          <Gift size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-semibold">Daily reward</h2>
          <p className="text-xs text-surface-muted">
            Day {mockDailyReward.streakDay} of {mockDailyReward.streakLength}
          </p>
        </div>
        <Button
          variant={mockDailyReward.claimable ? 'primary' : 'ghost'}
          size="sm"
          disabled={!mockDailyReward.claimable}
          onClick={() =>
            toast({
              title: `${formatCoins(mockDailyReward.amount)} coins added`,
              variant: 'success',
            })
          }
        >
          {mockDailyReward.claimable ? `Claim ${mockDailyReward.amount}` : 'Claimed'}
        </Button>
      </Card>

      {/* Tournament */}
      <PageSection
        title="Active tournament"
        action={
          <Link href="/tournaments" className="text-xs font-semibold text-gold-400">
            View all
          </Link>
        }
      >
        <Link href={`/tournaments/${mockTournament.id}`}>
          <Card interactive className="p-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tiger-500/15 text-tiger-300"
              >
                <Trophy size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-display text-sm font-semibold">
                    {mockTournament.name}
                  </h3>
                  <Badge variant="success" size="sm" dot>
                    Live
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-surface-muted">
                  Ends {formatRelativeTime(mockTournament.endsAt)} ·{' '}
                  {mockTournament.playerCount.toLocaleString('en-IN')} players
                </p>
                <dl className="mt-2 flex gap-4 text-xs">
                  <div>
                    <dt className="text-surface-muted">Prize pool</dt>
                    <dd className="font-semibold tabular-nums text-gold-400">
                      {formatCoins(mockTournament.prizePool, { compact: true })}
                    </dd>
                  </div>
                  {mockTournament.yourRank ? (
                    <div>
                      <dt className="text-surface-muted">Your rank</dt>
                      <dd className="font-semibold tabular-nums text-surface-subtle">
                        #{mockTournament.yourRank}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <ChevronRight size={18} aria-hidden="true" className="mt-1 shrink-0 text-surface-muted" />
            </div>
          </Card>
        </Link>
      </PageSection>

      {/* Recent results */}
      <PageSection
        title="Recent results"
        action={
          <Link href="/analytics" className="text-xs font-semibold text-gold-400">
            Full analytics
          </Link>
        }
      >
        <Card className="p-4">
          <RoundHistoryStrip history={mockOutcomeHistory} limit={20} />
        </Card>
      </PageSection>

      {/* Missions */}
      <PageSection
        title="Missions"
        action={
          <Link href="/rewards" className="text-xs font-semibold text-gold-400">
            View all
          </Link>
        }
      >
        <ul className="flex flex-col gap-2">
          {previewMissions.map((mission) => {
            const percent = Math.min(100, Math.round((mission.progress / mission.target) * 100));
            const isComplete = mission.status === 'completed';

            return (
              <li key={mission.id}>
                <Card className="p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-surface-fg">{mission.title}</h3>
                      <p className="mt-0.5 text-xs text-surface-muted">
                        {mission.progress} of {mission.target}
                      </p>
                    </div>
                    <Badge variant={isComplete ? 'success' : 'gold'} size="sm">
                      {isComplete ? 'Ready' : `+${mission.rewardAmount}`}
                    </Badge>
                  </div>

                  <div
                    className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-border"
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${mission.title} progress`}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-500',
                        isComplete ? 'bg-success-500' : 'bg-gold-500',
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </PageSection>

      {/* Responsible gaming reminder */}
      <Card variant="flat" className="p-4">
        <CardHeader className="flex-row items-center gap-2.5 p-0">
          <ShieldCheck size={18} aria-hidden="true" className="shrink-0 text-tiger-400" />
          <CardTitle as="h2" className="text-sm">
            A quick reminder
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-2">
          <CardDescription className="text-xs">
            Zitto uses virtual coins with no cash value. Every round is independent — take a break
            whenever you want one.
          </CardDescription>
          <Link
            href="/responsible-gaming"
            className="mt-2 inline-block text-xs font-semibold text-gold-400 underline-offset-2 hover:underline"
          >
            Set a session limit
          </Link>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
