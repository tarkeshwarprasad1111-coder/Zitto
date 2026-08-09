'use client';

import { useState } from 'react';
import { BarChart3, AlertCircle, TrendingUp, Zap } from 'lucide-react';
import { PageContainer, PageSection } from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { OutcomeDistributionChart } from '@/components/analytics/outcome-distribution-chart';
import { StreakIndicator } from '@/components/analytics/streak-indicator';
import { PredictionCard } from '@/components/analytics/prediction-card';
import { StatCard } from '@/components/analytics/stat-card';

// DISCLAIMER: All analytics describe past rounds. No outcome is guaranteed.
const DISCLAIMER =
  'Each round is independent. Historical frequencies describe past rounds only and cannot determine future outcomes.';

const WINDOWS = [10, 25, 50, 100] as const;
type Window = (typeof WINDOWS)[number];

type Confidence = 'insufficient_data' | 'none' | 'low' | 'moderate';

interface AnalyticsMeta {
  windowRounds: number;
  sampleSize: number;
  method: string;
  confidence: Confidence;
  dataQuality: 'good' | 'sparse' | 'insufficient';
  computedAt: string;
  disclaimer: string;
}

function ConfidenceBadge({ c }: { c: Confidence }) {
  const map: Record<Confidence, { label: string; variant: 'default' | 'warning' | 'info' | 'muted' }> = {
    insufficient_data: { label: 'Insufficient data', variant: 'muted' },
    none: { label: 'No reliable signal', variant: 'muted' },
    low: { label: 'Low confidence', variant: 'warning' },
    moderate: { label: 'Moderate signal', variant: 'info' },
  };
  const { label, variant } = map[c];
  return <Badge variant={variant as 'default'}>{label}</Badge>;
}

/** Renders the mandatory meta footer. Any analytics card MUST include this. */
function AnalyticsMetaFooter({ meta }: { meta: AnalyticsMeta }) {
  return (
    <div className="mt-3 border-t border-surface-border pt-3 text-xs text-surface-muted space-y-1">
      <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
        <span>{meta.sampleSize} rounds analysed</span>
        <span>·</span>
        <span>{meta.method}</span>
        <span>·</span>
        <ConfidenceBadge c={meta.confidence} />
        <span>·</span>
        <span>Updated {new Date(meta.computedAt).toLocaleTimeString()}</span>
      </div>
      <p className="text-surface-muted/80 italic">{meta.disclaimer}</p>
    </div>
  );
}

/** Wraps any analytics card. TypeScript enforces meta is always provided. */
function AnalyticsCard({
  title,
  icon,
  meta,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  meta: AnalyticsMeta; // non-optional — cannot render without it
  children: React.ReactNode;
}) {
  if (meta.confidence === 'insufficient_data') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-6 text-center gap-2">
            <AlertCircle className="h-8 w-8 text-surface-muted" />
            <p className="font-medium">Not enough data</p>
            <p className="text-sm text-surface-muted">
              {meta.sampleSize} rounds found — need at least 10.
            </p>
          </div>
          <AnalyticsMetaFooter meta={meta} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {children}
        <AnalyticsMetaFooter meta={meta} />
      </CardContent>
    </Card>
  );
}

// Stubbed data — replace with TanStack Query calls to /analytics/summary, /analytics/streaks, /analytics/prediction/current
const STUB_META: AnalyticsMeta = {
  windowRounds: 50,
  sampleSize: 47,
  method: 'Rolling frequency (last N settled rounds)',
  confidence: 'low',
  dataQuality: 'good',
  computedAt: new Date().toISOString(),
  disclaimer: DISCLAIMER,
};

const STUB_COUNTS = { DRAGON: 21, TIGER: 19, TIE: 7 };
const STUB_PERCENTAGES = { dragon: 44.7, tiger: 40.4, tie: 14.9 };

export default function AnalyticsPage() {
  const [window, setWindow] = useState<Window>(50);
  const loading = false; // replace with useQuery loading state

  if (loading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      {/* Header */}
      <PageSection>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gold-500" />
          <h1 className="font-display text-xl font-bold">Analytics</h1>
        </div>
        <p className="mt-1 text-sm text-surface-muted">
          Statistical observations based on your past rounds. Past results do not predict future outcomes.
        </p>
      </PageSection>

      {/* Window selector */}
      <PageSection>
        <div className="flex gap-2 flex-wrap">
          {WINDOWS.map((w) => (
            <Button
              key={w}
              size="sm"
              variant={window === w ? 'default' : 'outline'}
              onClick={() => setWindow(w)}
            >
              Last {w}
            </Button>
          ))}
        </div>
      </PageSection>

      {/* Outcome Distribution */}
      <AnalyticsCard
        title="Outcome Distribution"
        icon={<BarChart3 className="h-4 w-4 text-gold-400" />}
        meta={{ ...STUB_META, windowRounds: window }}
      >
        <OutcomeDistributionChart
          dragon={STUB_PERCENTAGES.dragon}
          tiger={STUB_PERCENTAGES.tiger}
          tie={STUB_PERCENTAGES.tie}
        />
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          {Object.entries(STUB_COUNTS).map(([side, count]) => (
            <div key={side}>
              <p className="text-lg font-bold">{count}</p>
              <p className="text-xs text-surface-muted capitalize">{side.toLowerCase()}</p>
            </div>
          ))}
        </div>
      </AnalyticsCard>

      {/* Streak */}
      <AnalyticsCard
        title="Streak Detection"
        icon={<TrendingUp className="h-4 w-4 text-dragon-500" />}
        meta={{ ...STUB_META, windowRounds: window }}
      >
        <StreakIndicator currentSide="DRAGON" currentLength={3} longestDragon={7} longestTiger={5} longestTie={2} />
      </AnalyticsCard>

      {/* Model estimate */}
      <AnalyticsCard
        title="Statistical Model Estimate"
        icon={<Zap className="h-4 w-4 text-amber-400" />}
        meta={{ ...STUB_META, confidence: 'low' }}
      >
        <PredictionCard
          estimate={{ side: 'DRAGON', historicalFrequency: 44.7 }}
          disclaimer={DISCLAIMER}
        />
      </AnalyticsCard>

      {/* Compliance footer */}
      <PageSection>
        <div className="rounded-lg bg-surface-card/50 border border-surface-border p-4 text-sm text-surface-muted">
          <p className="font-semibold mb-1 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            Statistical observations only
          </p>
          <p>{DISCLAIMER}</p>
          <p className="mt-1">
            Every round uses cryptographically random card draws. No model can predict the next outcome.
          </p>
        </div>
      </PageSection>
    </PageContainer>
  );
}
