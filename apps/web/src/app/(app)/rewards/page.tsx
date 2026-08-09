'use client';

import { useState } from 'react';
import { CheckCircle2, Gift, Tag, Trophy } from 'lucide-react';

import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
// MOCK: replace with TanStack Query calls to /rewards/missions and /wallet.
import { mockDailyReward, mockMissions } from '@/lib/mock-data';
import { formatCoins, formatRelativeTime } from '@/lib/utils';
import type { Mission } from '@/types';

function MissionRow({ mission }: { mission: Mission }) {
  const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
  const done = mission.status === 'completed';
  const claimed = mission.status === 'claimed';

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">{mission.title}</p>
              {claimed && <Badge variant="outline">Claimed</Badge>}
              {done && <Badge variant="success">Ready</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-surface-muted">{mission.description}</p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm font-bold tabular-nums text-gold-400">
              +{formatCoins(mission.rewardAmount)}
            </p>
            {done && (
              <Button size="sm" className="mt-1 h-6 text-xs">
                Claim
              </Button>
            )}
          </div>
        </div>

        <div className="mt-2">
          <div className="mb-1 flex justify-between text-xs tabular-nums text-surface-muted">
            <span>
              {mission.progress} / {mission.target}
            </span>
            <span>{pct}%</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-elevated"
            role="progressbar"
            aria-valuenow={mission.progress}
            aria-valuemin={0}
            aria-valuemax={mission.target}
            aria-label={mission.title}
          >
            <div
              className={`h-full rounded-full transition-all ${
                claimed || done ? 'bg-emerald-500' : 'bg-gold-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RewardsPage() {
  const [promoCode, setPromoCode] = useState('');
  const [claiming, setClaiming] = useState(false);

  const { claimable, amount, streakDay, nextClaimAt } = mockDailyReward;

  async function handleClaimDaily() {
    setClaiming(true);
    // TODO: POST /rewards/daily-reward with an Idempotency-Key header.
    await new Promise((r) => setTimeout(r, 800));
    setClaiming(false);
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold">
          <Gift className="h-5 w-5 text-gold-500" />
          Rewards
        </h1>
      </PageSection>

      <PageSection>
        <Card className="border-gold-500/30 bg-gold-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Daily login reward</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-gold-400">
                  +{formatCoins(amount)}
                </p>
                <p className="mt-1 text-xs text-surface-muted">
                  {claimable ? (
                    `Day ${streakDay} of your streak`
                  ) : (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Claimed
                      {nextClaimAt ? ` — next ${formatRelativeTime(nextClaimAt)}` : ''}
                    </span>
                  )}
                </p>
              </div>
              <Button onClick={handleClaimDaily} disabled={!claimable} isLoading={claiming}>
                {claimable ? 'Claim' : 'Claimed'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageSection>

      <PageSection>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Tag className="h-4 w-4" aria-hidden="true" />
          Redeem a promo code
        </h2>
        <div className="flex gap-2">
          <label htmlFor="promo" className="sr-only">
            Promo code
          </label>
          <Input
            id="promo"
            placeholder="Enter code"
            value={promoCode}
            autoCapitalize="characters"
            onChange={(e) => setPromoCode(e.target.value)}
            className="flex-1"
          />
          <Button disabled={!promoCode.trim()}>Redeem</Button>
        </div>
      </PageSection>

      <PageSection>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Trophy className="h-4 w-4 text-gold-400" aria-hidden="true" />
          Missions
        </h2>
        {mockMissions.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-8 w-8" />}
            title="No missions right now"
            description="New missions appear daily."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {mockMissions.map((m) => (
              <MissionRow key={m.id} mission={m} />
            ))}
          </div>
        )}
      </PageSection>
    </PageContainer>
  );
}
