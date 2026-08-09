'use client';

import { useState } from 'react';
import { Gift, CheckCircle2, Trophy, Tag } from 'lucide-react';
import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { mockMissions, mockDailyReward } from '@/lib/mock-data';
import { formatCoins } from '@/lib/utils';

export default function RewardsPage() {
  const [promoCode, setPromoCode] = useState('');
  const [claimingDaily, setClaimingDaily] = useState(false);

  const claimed = mockDailyReward.claimed;

  async function handleClaimDaily() {
    setClaimingDaily(true);
    // TODO: POST /rewards/daily-reward with Idempotency-Key
    await new Promise((r) => setTimeout(r, 1000));
    setClaimingDaily(false);
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <Gift className="h-5 w-5 text-gold-500" />
          Rewards
        </h1>
      </PageSection>

      {/* Daily reward */}
      <PageSection>
        <Card className="border-gold-500/30 bg-gold-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Daily Login Reward</p>
                <p className="text-2xl font-display font-bold text-gold-400 mt-1">
                  +{formatCoins(BigInt(mockDailyReward.amount))} coins
                </p>
                {claimed && (
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Claimed today — come back tomorrow!
                  </p>
                )}
              </div>
              <Button
                onClick={handleClaimDaily}
                disabled={claimed || claimingDaily}
                loading={claimingDaily}
              >
                {claimed ? 'Claimed' : 'Claim'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageSection>

      {/* Promo code */}
      <PageSection>
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Redeem Promo Code
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder="Enter code…"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            className="flex-1"
          />
          <Button disabled={!promoCode.trim()}>Redeem</Button>
        </div>
      </PageSection>

      {/* Missions */}
      <PageSection>
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold-400" />
          Daily Missions
        </h2>
        {mockMissions.length === 0 ? (
          <EmptyState icon={<Trophy className="h-8 w-8" />} title="No missions today" description="Check back tomorrow." />
        ) : (
          <div className="space-y-3">
            {mockMissions.map((m) => {
              const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
              const done = m.completedAt != null;
              return (
                <Card key={m.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{m.name}</p>
                          {done && <Badge variant="default" className="bg-emerald-600 text-xs">Done</Badge>}
                        </div>
                        <p className="text-xs text-surface-muted mt-0.5">{m.description}</p>
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-surface-muted mb-1">
                            <span>{m.progress} / {m.target}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-surface-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gold-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gold-400">+{formatCoins(BigInt(m.rewardAmount))}</p>
                        {done && !m.claimedAt && (
                          <Button size="sm" className="mt-1 text-xs h-6">Claim</Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </PageSection>
    </PageContainer>
  );
}
