'use client';

import { useState } from 'react';
import { Coins, ArrowDownCircle, ArrowUpCircle, Clock } from 'lucide-react';
import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { mockWallet } from '@/lib/mock-data';
import { formatCoins } from '@/lib/utils';

const LEDGER_TYPE_LABELS: Record<string, string> = {
  BET: 'Bet placed',
  WIN: 'Win',
  REFUND: 'Refund',
  DAILY_REWARD: 'Daily reward',
  MISSION: 'Mission',
  ACHIEVEMENT: 'Achievement',
  REFERRAL: 'Referral',
  PROMO_CODE: 'Promo code',
  ADMIN_CREDIT: 'Admin credit',
  TOURNAMENT_PRIZE: 'Tournament prize',
  SIGNUP: 'Welcome bonus',
};

function LedgerRow({
  type,
  amount,
  balanceAfter,
  createdAt,
}: {
  type: string;
  amount: bigint;
  balanceAfter: bigint;
  createdAt: string;
}) {
  const isCredit = amount > 0n;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-border last:border-0">
      <div className={`rounded-full p-2 ${isCredit ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
        {isCredit ? (
          <ArrowDownCircle className="h-4 w-4 text-emerald-400" />
        ) : (
          <ArrowUpCircle className="h-4 w-4 text-red-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{LEDGER_TYPE_LABELS[type] ?? type}</p>
        <p className="text-xs text-surface-muted">{new Date(createdAt).toLocaleString()}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${isCredit ? 'text-emerald-400' : 'text-red-400'}`}>
          {isCredit ? '+' : ''}{formatCoins(amount)}
        </p>
        <p className="text-xs text-surface-muted">{formatCoins(balanceAfter)}</p>
      </div>
    </div>
  );
}

// Stub ledger entries
const STUB_LEDGER = [
  { id: '1', type: 'WIN', amount: 200n, balanceAfter: 700n, createdAt: new Date().toISOString() },
  { id: '2', type: 'BET', amount: -100n, balanceAfter: 500n, createdAt: new Date(Date.now() - 60000).toISOString() },
  { id: '3', type: 'DAILY_REWARD', amount: 100n, balanceAfter: 600n, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: '4', type: 'SIGNUP', amount: 500n, balanceAfter: 500n, createdAt: new Date(Date.now() - 86400000).toISOString() },
];

export default function WalletPage() {
  const [filter, setFilter] = useState<'all' | 'credits' | 'debits'>('all');
  const loading = false;

  const filtered = STUB_LEDGER.filter((e) => {
    if (filter === 'credits') return e.amount > 0n;
    if (filter === 'debits') return e.amount < 0n;
    return true;
  });

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <Coins className="h-5 w-5 text-gold-500" />
          Virtual Wallet
        </h1>
        <p className="text-xs text-surface-muted mt-1">
          Zitto coins have no cash value and cannot be exchanged for real money.
        </p>
      </PageSection>

      {/* Balance cards */}
      <div className="grid grid-cols-2 gap-3 px-4">
        <Card className="col-span-2">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-4xl font-display font-bold text-gold-400">{formatCoins(mockWallet.balance)}</p>
            <p className="text-sm text-surface-muted mt-1">Available balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xl font-bold">{formatCoins(mockWallet.bonusBalance)}</p>
            <p className="text-xs text-surface-muted">Bonus coins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xl font-bold">{formatCoins(mockWallet.lockedBalance)}</p>
            <p className="text-xs text-surface-muted">Locked coins</p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger */}
      <PageSection>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Transaction History</h2>
          <div className="flex gap-1">
            {(['all', 'credits', 'debits'] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'ghost'} onClick={() => setFilter(f)} className="capitalize text-xs h-7">
                {f}
              </Button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Clock className="h-8 w-8" />} title="No transactions" description="Your transaction history will appear here." />
        ) : (
          <Card>
            <CardContent className="pt-4 pb-2">
              {filtered.map((e) => (
                <LedgerRow key={e.id} {...e} />
              ))}
            </CardContent>
          </Card>
        )}
      </PageSection>
    </PageContainer>
  );
}
