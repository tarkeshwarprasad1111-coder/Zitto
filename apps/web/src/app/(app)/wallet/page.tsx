'use client';

import { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Clock, Coins } from 'lucide-react';

import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
// MOCK: replace with TanStack Query calls to /wallet and /wallet/ledger.
import { mockLedger, mockWallet } from '@/lib/mock-data';
import { formatCoins, formatRelativeTime } from '@/lib/utils';
import type { LedgerEntry } from '@/types';

const FILTERS = ['all', 'credits', 'debits'] as const;
type Filter = (typeof FILTERS)[number];

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const isCredit = entry.amount > 0;

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
        <p className="truncate text-sm font-medium">{entry.description}</p>
        <p className="text-xs text-surface-muted">{formatRelativeTime(entry.createdAt)}</p>
      </div>

      <div className="text-right">
        <p
          className={`text-sm font-semibold tabular-nums ${
            isCredit ? 'text-emerald-400' : 'text-dragon-400'
          }`}
        >
          {isCredit ? '+' : '−'}
          {formatCoins(Math.abs(entry.amount))}
        </p>
        {/* Running balance sits under every row: the ledger is the source of
            truth and the headline balance is derived from it, not the reverse. */}
        <p className="text-xs tabular-nums text-surface-muted">{formatCoins(entry.balanceAfter)}</p>
      </div>
    </li>
  );
}

export default function WalletPage() {
  const [filter, setFilter] = useState<Filter>('all');

  const entries = useMemo(
    () =>
      mockLedger.filter((e) => {
        if (filter === 'credits') return e.amount > 0;
        if (filter === 'debits') return e.amount < 0;
        return true;
      }),
    [filter],
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
              {formatCoins(mockWallet.balance)}
            </p>
            <p className="mt-1 text-sm text-surface-muted">Available balance</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold tabular-nums">{formatCoins(mockWallet.bonus)}</p>
              <p className="text-xs text-surface-muted">Bonus coins</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold tabular-nums">{formatCoins(mockWallet.locked)}</p>
              <p className="text-xs text-surface-muted">Locked in play</p>
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

        {entries.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-8 w-8" />}
            title={filter === 'all' ? 'No transactions yet' : `No ${filter} to show`}
            description={
              filter === 'all'
                ? 'Your coin activity will appear here once you play a round.'
                : 'Try a different filter.'
            }
          />
        ) : (
          <Card>
            <CardContent className="py-2">
              <ul>
                {entries.map((entry) => (
                  <LedgerRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </PageSection>
    </PageContainer>
  );
}
