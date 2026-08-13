'use client';

import { useMemo, useState } from 'react';
import { BarChart3, Info } from 'lucide-react';

import { OutcomeDistributionChart } from '@/components/analytics/outcome-distribution-chart';
import { PredictionCard } from '@/components/analytics/prediction-card';
import { StatCard } from '@/components/analytics/stat-card';
import { StreakIndicator } from '@/components/analytics/streak-indicator';
import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  MIN_SAMPLE,
  predictFromPlayedRounds,
  roundsStaked,
  sessionNet,
  summarisePlayedRounds,
} from '@/lib/analytics';
import { formatCoins, formatPercent } from '@/lib/utils';
import { useGameStore } from '@/store/game-store';
import type { AnalyticsWindow } from '@/types';

const WINDOWS: readonly AnalyticsWindow[] = [10, 25, 50, 100];

/**
 * Analytics dashboard.
 *
 * Nothing here renders a bare figure. Every card takes `sampleSize`, `window`,
 * `method` and `lastUpdated` as required props, so a number cannot reach the
 * screen without the context needed to judge it. `PredictionCard` goes further
 * and throws when its provenance fields are missing — a loud failure in
 * development is preferable to a confident-looking figure in production.
 */
export default function AnalyticsPage() {
  const [window, setWindow] = useState<AnalyticsWindow>(50);

  // Real rounds this device has settled, not fixtures. Play changes these.
  const playedRounds = useGameStore((state) => state.playedRounds);

  const summary = useMemo(
    () => summarisePlayedRounds(playedRounds, window),
    [playedRounds, window],
  );
  const prediction = useMemo(
    () => predictFromPlayedRounds(playedRounds, window),
    [playedRounds, window],
  );
  const net = useMemo(() => sessionNet(playedRounds, window), [playedRounds, window]);
  const staked = useMemo(() => roundsStaked(playedRounds, window), [playedRounds, window]);

  /*
   * Below the minimum sample the page shows nothing but an explanation.
   * Rendering cards full of zeroes would read as "Dragon has never won",
   * which is a claim about the game rather than about the missing data.
   */
  if (summary.sampleSize < MIN_SAMPLE) {
    return (
      <PageContainer className="flex flex-col gap-6">
        <PageSection>
          <h1 className="flex items-center gap-2 font-display text-xl font-bold">
            <BarChart3 className="h-5 w-5 text-gold-500" />
            Analytics
          </h1>
        </PageSection>

        <PageSection>
          <EmptyState
            icon={<BarChart3 className="h-8 w-8" />}
            title="Not enough rounds yet"
            description={
              summary.sampleSize === 0
                ? `Play a few rounds and your statistics appear here. At least ${MIN_SAMPLE} are needed before any figure is worth showing.`
                : `${summary.sampleSize} of ${MIN_SAMPLE} rounds recorded. Keep playing and this fills in.`
            }
          />
        </PageSection>

        <PageSection>
          <div className="rounded-lg border border-surface-border bg-surface-card/50 p-4 text-sm text-surface-muted">
            <p>
              Figures here describe rounds you have already played. Dragon Tiger draws are
              independent, so nothing on this page can tell you what comes next.
            </p>
          </div>
        </PageSection>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageSection>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold">
          <BarChart3 className="h-5 w-5 text-gold-500" />
          Analytics
        </h1>
        <p className="mt-1 text-sm text-surface-muted">
          Statistical observations drawn from rounds you have already played.
        </p>
      </PageSection>

      <PageSection>
        <div
          role="group"
          aria-label="Rounds to analyse"
          className="flex flex-wrap gap-2"
        >
          {WINDOWS.map((w) => (
            <Button
              key={w}
              size="sm"
              variant={window === w ? 'primary' : 'outline'}
              aria-pressed={window === w}
              onClick={() => setWindow(w)}
            >
              Last {w}
            </Button>
          ))}
        </div>
      </PageSection>

      <PageSection className="flex flex-col gap-4">
        <OutcomeDistributionChart
          counts={summary.counts}
          frequencies={summary.frequencies}
          sampleSize={summary.sampleSize}
          window={window}
          method={summary.method}
          lastUpdated={summary.lastUpdated}
        />

        <StreakIndicator
          streak={summary.streak}
          sampleSize={summary.sampleSize}
          window={window}
          lastUpdated={summary.lastUpdated}
        />

        <StatCard
          value={formatPercent(summary.tieRate)}
          label="Tie rate"
          sampleSize={summary.sampleSize}
          window={window}
          method={summary.method}
          lastUpdated={summary.lastUpdated}
        />

        <StatCard
          value={`${net >= 0 ? '+' : '−'}${formatCoins(Math.abs(net))}`}
          label="Net coins over these rounds"
          sampleSize={staked}
          window={window}
          method={`Stake subtracted from payout across the ${staked} of ${summary.sampleSize} rounds you backed a side on. Rounds you sat out are excluded.`}
          lastUpdated={summary.lastUpdated}
        />

        <PredictionCard estimate={prediction} />
      </PageSection>

      <PageSection>
        <div className="rounded-lg border border-surface-border bg-surface-card/50 p-4 text-sm text-surface-muted">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-surface-subtle">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            How to read this page
          </p>
          <p>
            Cards describe rounds that have already been played. Dragon Tiger draws are
            independent, so a run of one outcome does not make the other more likely next.
          </p>
          <p className="mt-1.5">
            Confidence never rises above &ldquo;Moderate signal&rdquo;. No sample size would justify
            a stronger claim about an independent draw.
          </p>
        </div>
      </PageSection>
    </PageContainer>
  );
}
