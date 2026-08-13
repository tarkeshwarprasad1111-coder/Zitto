'use client';

import { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Clock, Coins } from 'lucide-react';

import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { PlayedRound } from '@/lib/analytics';
import { formatCoins, formatRelativeTime } from '@/lib/utils';
import { useGameStore } from '@/store/game-store';

const FILTERS = ['all', 'credits', 'debits'] as const;
type Filter = (typeof FILTERS)[number];

interface Movement {
  id: string;
  label: string;
  /** Signed: positive credits the balance, negative debits it. */
  amount: number;
  at: string;
}

/**
 * Turns played rounds into the movements they caused.
 *
 * A round produces up to two entries — the stake leaving and, if it won, the
 * return arriving. Showing them separately is what makes the running total
 * legible; a single net figure per round hides the size of the bet.
 */
function movementsFrom(rounds: readonly PlayedRound[]): Movement[] {
  const out: Movement[] = [];

  rounds.forEach((round, index) => {
    if (round.side === null || round.amount === 0) return;

    const side = `${round.side.charAt(0)}${round.side.slice(1).toLowerCase()}`;

    if (round.payout > 0) {
      out.push({
        id: `${index}-win`,
        label: `Won on ${side}`,
        amount: round.payout,
        at: round.settledAt,
      });
    }

    out.push({
      id: `${index}-bet`,
      label: `Stake on ${side}`,
      amount: -round.amount,
      at: round.settledAt,
    });
  });

  return out;
}

function MovementRow({ movement }: { movement: Movement }) {
  const isCredit = movement.amount > 0;

  return (
    <li className="flex items-center gap-3 border-b border-surface-border py-3 last:border-0">
      <span
        className={`rounded-full p-2 ${isCredit ? 'bg-emerald-500/10' : 'bg-dragon-500/10'}`}
        aria-hidden="true"
      >
        {isCredit ? (
          <ArrowDownCircle className="h-4 w-4 text-emerald-400" />
        ) : (
          <ArrowUpCircle className="h-4 w-4 text-dragon-400" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{movement.label}</p>
        <p className="text-xs text-surface-muted">{formatRelativeTime(movement.at)}</p>
      </div>

      <p
        className={`text-sm font-semibold tabular-nums ${
          isCredit ? 'text-emerald-400' : 'text-dragon-400'
        }`}
      >
        {isCredit ? '+' : '−'}
        {formatCoins(Math.abs(movement.amount))}
      </p>
    </li>
  );
}

export default function WalletPage() {
  const [filter, setFilter] = useState<Filter>('all');

  const balance = useGameStore((state) => state.balance);
  const playedRounds = useGameStore((state) => state.playedRounds);

  const movements = useMemo(() => movementsFrom(playedRounds), [playedRounds]);

  const staked = useMemo(
    () => playedRounds.reduce((total, r) => total + r.amount, 0),
    [playedRounds],
  );
  const returned = useMemo(
    () => playedRounds.reduce((total, r) => total + r.payout, 0),
    [playedRounds],
  );

  const shown = useMemo(
    () =>
      movements.filter((m) => {
        if (filter === 'credits') return m.amount > 0;
        if (filter === 'debits') return m.amount < 0;
        return true;
      }),
    [movements, filter],
  );

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold">
          <Coins className="h-5 w-5 text-gold-500" />
          Virtual wallet
        </h1>
        <p className="mt-1 text-xs text-surface-muted">
          Zitto coins have no cash value. They cannot be purchased, exchanged, or withdrawn.
        </p>
      </PageSection>

      <PageSection className="flex flex-col gap-3">
        <Card>
          <CardContent className="py-5 text-center">
            <p className="font-display text-4xl font-bold tabular-nums text-gold-400">
              {formatCoins(balance)}
            </p>
            <p className="mt-1 text-sm text-surface-muted">Available balance</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold tabular-nums">{formatCoins(staked)}</p>
              <p className="text-xs text-surface-muted">Total staked</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold tabular-nums">{formatCoins(returned)}</p>
              <p className="text-xs text-surface-muted">Total returned</p>
            </CardContent>
          </Card>
        </div>
      </PageSection>

      <PageSection>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Transactions</h2>
          <div role="group" aria-label="Filter transactions" className="flex gap-1">
            {FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'primary' : 'ghost'}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className="h-7 text-xs capitalize"
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-8 w-8" />}
            title={filter === 'all' ? 'No transactions yet' : `No ${filter} to show`}
            description={
              filter === 'all'
                ? 'Back a side on a round and the stake and any return appear here.'
                : 'Try a different filter.'
            }
          />
        ) : (
          <Card>
            <CardContent className="py-2">
              <ul>
                {shown.map((movement) => (
                  <MovementRow key={movement.id} movement={movement} />
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </PageSection>
    </PageContainer>
  );
}
