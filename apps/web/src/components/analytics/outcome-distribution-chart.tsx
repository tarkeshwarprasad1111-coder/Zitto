'use client';

import { useId, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card } from '@/components/ui/card';
import { cn, formatPercent, formatRelativeTime } from '@/lib/utils';
import type { AnalyticsWindow, OutcomeDistribution, Outcome } from '@/types';

/**
 * Category colours follow the entity, not the value — Dragon is always red,
 * Tiger always blue, Tie always gold, in every chart across the product. The
 * lighter 400 steps are used because the chart surface is near-black.
 *
 * Colour alone never carries identity here: each bar is named on the x-axis,
 * its value is direct-labelled on the cap, and the same numbers are repeated
 * in the table view below.
 */
const CATEGORY_COLORS: Record<Outcome, string> = {
  DRAGON: '#F87171',
  TIGER: '#60A5FA',
  TIE: '#FBBF24',
};

const CATEGORY_LABELS: Record<Outcome, string> = {
  DRAGON: 'Dragon',
  TIGER: 'Tiger',
  TIE: 'Tie',
};

const ORDER: readonly Outcome[] = ['DRAGON', 'TIGER', 'TIE'];

interface ChartDatum {
  key: Outcome;
  name: string;
  count: number;
  frequency: number;
  color: string;
}

export interface OutcomeDistributionChartProps {
  counts: OutcomeDistribution;
  frequencies: OutcomeDistribution;
  sampleSize: number;
  window: AnalyticsWindow;
  method: string;
  lastUpdated: string;
  className?: string;
}

export function OutcomeDistributionChart({
  counts,
  frequencies,
  sampleSize,
  window,
  method,
  lastUpdated,
  className,
}: OutcomeDistributionChartProps) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  const data: ChartDatum[] = ORDER.map((key) => ({
    key,
    name: CATEGORY_LABELS[key],
    count: counts[key],
    frequency: frequencies[key],
    color: CATEGORY_COLORS[key],
  }));

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card className={cn('flex flex-col gap-3 p-4', className)}>
      <header>
        <h3 className="font-display text-sm font-semibold text-surface-fg">Outcome distribution</h3>
        <p className="mt-0.5 text-xs text-surface-muted">
          How often each side came up across the last {sampleSize.toLocaleString('en-IN')} settled
          rounds.
        </p>
      </header>

      {/* Height includes the x-axis band so labels are never cut off. */}
      <div className="h-56 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, bottom: 4, left: -12 }}>
            <CartesianGrid
              vertical={false}
              stroke="rgb(42 42 56)"
              strokeWidth={1}
              // Solid hairline — dashed grids read as thresholds.
            />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={{ stroke: 'rgb(42 42 56)' }}
              tick={{ fill: 'rgb(139 139 158)', fontSize: 12 }}
              dy={4}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'rgb(139 139 158)', fontSize: 11 }}
              width={44}
              domain={[0, Math.ceil(maxCount * 1.15)]}
              allowDecimals={false}
            />
            <RechartsTooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={<DistributionTooltip sampleSize={sampleSize} />}
            />
            <Bar dataKey="count" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
              {/* Only three bars, so labelling every cap is informative, not noise. */}
              <LabelList
                dataKey="count"
                position="top"
                offset={8}
                fill="rgb(180 180 198)"
                fontSize={12}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Text alternative — the accessible twin of the chart above. */}
      <button
        type="button"
        onClick={() => setShowTable((value) => !value)}
        aria-expanded={showTable}
        aria-controls={tableId}
        className="self-start text-xs font-semibold text-gold-400 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-gold-400"
      >
        {showTable ? 'Hide data table' : 'View data as a table'}
      </button>

      <div id={tableId} className={cn(!showTable && 'sr-only')}>
        <table className="w-full text-left text-xs">
          <caption className="sr-only">
            Outcome distribution across the last {sampleSize} settled rounds, in a {window}-round
            rolling window.
          </caption>
          <thead>
            <tr className="border-b border-surface-border text-surface-muted">
              <th scope="col" className="py-1.5 font-medium">
                Outcome
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Rounds
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.key} className="border-b border-surface-border/50 last:border-0">
                <th scope="row" className="py-1.5 font-normal text-surface-subtle">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: row.color }}
                    />
                    {row.name}
                  </span>
                </th>
                <td className="py-1.5 text-right tabular-nums text-surface-subtle">{row.count}</td>
                <td className="py-1.5 text-right tabular-nums text-surface-subtle">
                  {formatPercent(row.frequency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-surface-muted">
              <th scope="row" className="py-1.5 font-medium">
                Total
              </th>
              <td className="py-1.5 text-right tabular-nums">{sampleSize}</td>
              <td className="py-1.5 text-right tabular-nums">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Provenance */}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-surface-border/70 pt-2.5 text-2xs">
        <div className="flex items-baseline gap-1">
          <dt className="text-surface-muted">Rounds</dt>
          <dd className="font-medium tabular-nums text-surface-subtle">
            {sampleSize.toLocaleString('en-IN')}
          </dd>
        </div>
        <div className="flex items-baseline gap-1">
          <dt className="text-surface-muted">Window</dt>
          <dd className="font-medium tabular-nums text-surface-subtle">{window}</dd>
        </div>
        <div className="col-span-2 flex items-baseline gap-1">
          <dt className="text-surface-muted">Updated</dt>
          <dd className="font-medium text-surface-subtle">
            <time dateTime={lastUpdated}>{formatRelativeTime(lastUpdated)}</time>
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="sr-only">Method</dt>
          <dd className="leading-relaxed text-surface-muted">{method}</dd>
        </div>
      </dl>
    </Card>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
  sampleSize: number;
}

function DistributionTooltip({ active, payload, sampleSize }: TooltipProps) {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-overlay px-3 py-2 text-xs shadow-elevated">
      <p className="flex items-center gap-2 font-semibold text-surface-fg">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: datum.color }}
        />
        {datum.name}
      </p>
      <p className="mt-1 tabular-nums text-surface-subtle">
        {datum.count} of {sampleSize} rounds
      </p>
      <p className="tabular-nums text-surface-muted">{formatPercent(datum.frequency)} of sample</p>
    </div>
  );
}
