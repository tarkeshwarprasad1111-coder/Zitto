'use client';

import { Flame } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, formatRelativeTime, outcomeLabel, OUTCOME_STYLES } from '@/lib/utils';
import type { AnalyticsWindow, StreakInfo } from '@/types';

export interface StreakIndicatorProps {
  streak: StreakInfo;
  sampleSize: number;
  window: AnalyticsWindow;
  lastUpdated: string;
  className?: string;
}

/**
 * Current and longest run inside the analysed window.
 *
 * A streak is a description of what already happened. The copy here is
 * deliberate: no "due for a change", no "ride the streak" — both are the
 * gambler's fallacy wearing a UI.
 */
export function StreakIndicator({
  streak,
  sampleSize,
  window,
  lastUpdated,
  className,
}: StreakIndicatorProps) {
  const currentStyles = streak.side ? OUTCOME_STYLES[streak.side] : null;
  const longestStyles = streak.longestSide ? OUTCOME_STYLES[streak.longestSide] : null;

  return (
    <Card className={cn('flex flex-col gap-3 p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-surface-fg">Streaks</h3>
        <Tooltip
          label="How streaks are calculated"
          content={
            <span className="flex flex-col gap-1.5">
              <span className="block font-semibold text-surface-fg">Method</span>
              <span className="block">
                A streak counts consecutive rounds with the same outcome, scanning the last{' '}
                {sampleSize} settled rounds newest-first.
              </span>
              <span className="block pt-1 text-surface-muted">
                Runs of the same result are expected in independent draws. A long streak does not
                make the opposite side more likely on the next round.
              </span>
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-surface-border bg-surface-bg/40 p-3">
          <p className="text-2xs text-surface-muted">Current run</p>
          {streak.side && streak.length > 1 ? (
            <p className={cn('mt-1 flex items-baseline gap-1.5', currentStyles?.text)}>
              <span className="font-sans text-2xl font-semibold leading-none">{streak.length}</span>
              <span className="text-xs font-medium">{outcomeLabel(streak.side)}</span>
            </p>
          ) : (
            <p className="mt-1 font-sans text-2xl font-semibold leading-none text-surface-subtle">
              None
            </p>
          )}
          <p className="mt-1 text-2xs text-surface-muted">
            {streak.side && streak.length > 1
              ? 'Consecutive rounds so far'
              : 'Last two rounds differed'}
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-bg/40 p-3">
          <p className="flex items-center gap-1 text-2xs text-surface-muted">
            <Flame size={11} aria-hidden="true" />
            Longest in window
          </p>
          <p className={cn('mt-1 flex items-baseline gap-1.5', longestStyles?.text ?? 'text-surface-subtle')}>
            <span className="font-sans text-2xl font-semibold leading-none">
              {streak.longestInWindow}
            </span>
            {streak.longestSide ? (
              <span className="text-xs font-medium">{outcomeLabel(streak.longestSide)}</span>
            ) : null}
          </p>
          <p className="mt-1 text-2xs text-surface-muted">Across {sampleSize} rounds</p>
        </div>
      </div>

      <p className="text-2xs leading-relaxed text-surface-muted">
        A statistical observation of past rounds. Runs like these occur naturally in independent
        draws and carry no information about the next result.
      </p>

      <dl className="grid grid-cols-2 gap-x-3 border-t border-surface-border/70 pt-2.5 text-2xs">
        <div className="flex items-baseline gap-1">
          <dt className="text-surface-muted">Window</dt>
          <dd className="font-medium tabular-nums text-surface-subtle">{window}</dd>
        </div>
        <div className="flex items-baseline gap-1">
          <dt className="text-surface-muted">Updated</dt>
          <dd className="font-medium text-surface-subtle">
            <time dateTime={lastUpdated}>{formatRelativeTime(lastUpdated)}</time>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
