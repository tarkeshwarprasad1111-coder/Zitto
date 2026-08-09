'use client';

import { Card } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { AnalyticsWindow } from '@/types';

export interface StatCardProps {
  /** The headline figure, pre-formatted (e.g. `48.2%`, `1,204`). */
  value: string;
  /** What the figure measures, e.g. "Dragon frequency". */
  label: string;
  /** Rounds actually included in the calculation. */
  sampleSize: number;
  /** The rolling window the figure was requested over. */
  window: AnalyticsWindow;
  /** How the figure was derived. Shown in the tooltip. */
  method: string;
  /** When the figure was last recomputed. */
  lastUpdated: string;
  /** Optional accent, e.g. Dragon red for a Dragon-frequency tile. */
  accent?: 'dragon' | 'tiger' | 'gold' | 'neutral';
  /** Optional secondary line, e.g. raw counts behind the percentage. */
  detail?: string;
  className?: string;
}

const accentStyles = {
  dragon: 'text-dragon-400',
  tiger: 'text-tiger-400',
  gold: 'text-gold-400',
  neutral: 'text-surface-fg',
} as const;

/**
 * A single analytics figure, shown with its full provenance.
 *
 * Every stat on this platform must be readable together with the data it came
 * from. A percentage with no sample size, window, method or timestamp is a
 * claim rather than an observation, so this component **throws** when any of
 * those are missing — a loud failure in development beats a misleading number
 * in front of a player.
 */
export function StatCard({
  value,
  label,
  sampleSize,
  window,
  method,
  lastUpdated,
  accent = 'neutral',
  detail,
  className,
}: StatCardProps) {
  const missing: string[] = [];
  if (value === undefined || value === null || value === '') missing.push('value');
  if (!label) missing.push('label');
  if (sampleSize === undefined || sampleSize === null || Number.isNaN(sampleSize)) {
    missing.push('sampleSize');
  }
  if (!window) missing.push('window');
  if (!method) missing.push('method');
  if (!lastUpdated) missing.push('lastUpdated');

  if (missing.length > 0) {
    throw new Error(
      `StatCard requires full provenance. Missing: ${missing.join(', ')}. ` +
        'A statistic may not be displayed without its sample size, window, method and last-updated time.',
    );
  }

  return (
    <Card className={cn('flex flex-col gap-2 p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug text-surface-muted">{label}</p>
        <Tooltip
          label={`How ${label} is calculated`}
          content={
            <span className="flex flex-col gap-1.5">
              <span className="block font-semibold text-surface-fg">Method</span>
              <span className="block">{method}</span>
              <span className="block pt-1 text-surface-muted">
                Based on {sampleSize.toLocaleString('en-IN')} rounds in a {window}-round rolling
                window. This describes rounds that have already happened; it does not predict the
                next one.
              </span>
            </span>
          }
        />
      </div>

      {/* Stat-tile value: proportional figures, sans face, no tabular-nums. */}
      <p className={cn('font-sans text-3xl font-semibold leading-none', accentStyles[accent])}>
        {value}
      </p>

      {detail ? <p className="text-xs text-surface-subtle">{detail}</p> : null}

      {/* Provenance — never hidden behind a disclosure. */}
      <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1 border-t border-surface-border/70 pt-2.5 text-2xs">
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
      </dl>
    </Card>
  );
}
