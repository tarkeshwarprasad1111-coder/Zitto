'use client';

import { cn, outcomeLabel, outcomeShortLabel } from '@/lib/utils';
import type { Outcome } from '@/types';

const dotStyles: Record<Outcome, string> = {
  DRAGON: 'bg-dragon-600 text-white',
  TIGER: 'bg-tiger-600 text-white',
  TIE: 'bg-gold-500 text-surface-bg',
};

export interface RoundHistoryStripProps {
  /** Outcomes newest-first. Only the first `limit` are shown. */
  history: Outcome[];
  limit?: number;
  /** Prepend counts of each outcome across the shown slice. */
  showLegend?: boolean;
  className?: string;
}

/**
 * Horizontal strip of recent outcomes.
 *
 * This is a record of what has already happened — it carries no predictive
 * weight, and the caption says so. Each dot is labelled with a letter as
 * well as a colour so it is readable without colour vision.
 */
export function RoundHistoryStrip({
  history,
  limit = 20,
  showLegend = true,
  className,
}: RoundHistoryStripProps) {
  const shown = history.slice(0, limit);

  const counts = shown.reduce<Record<Outcome, number>>(
    (acc, outcome) => {
      acc[outcome] += 1;
      return acc;
    },
    { DRAGON: 0, TIGER: 0, TIE: 0 },
  );

  if (shown.length === 0) {
    return (
      <p className={cn('text-sm text-surface-muted', className)}>
        No rounds recorded yet on this table.
      </p>
    );
  }

  return (
    <section className={cn('flex flex-col gap-2', className)} aria-label="Recent round outcomes">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-muted">
          Last {shown.length} rounds
        </h3>
        {showLegend ? (
          <p className="text-2xs text-surface-muted">
            <span className="text-dragon-400">D {counts.DRAGON}</span>
            <span className="mx-1.5 opacity-40">·</span>
            <span className="text-tiger-400">T {counts.TIGER}</span>
            <span className="mx-1.5 opacity-40">·</span>
            <span className="text-gold-400">Tie {counts.TIE}</span>
          </p>
        ) : null}
      </div>

      <ol className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
        {shown.map((outcome, index) => (
          <li key={`${outcome}-${index}`} className="shrink-0">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-2xs font-bold leading-none',
                dotStyles[outcome],
                index === 0 && 'ring-2 ring-surface-fg/25',
              )}
              title={`${index === 0 ? 'Most recent' : `${index + 1} rounds ago`}: ${outcomeLabel(outcome)}`}
            >
              <span aria-hidden="true">{outcomeShortLabel(outcome)}</span>
              <span className="sr-only">
                {index === 0 ? 'Most recent' : `${index + 1} rounds ago`}: {outcomeLabel(outcome)}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="text-2xs leading-relaxed text-surface-muted">
        A record of past results only. Every round is independent — these outcomes do not influence
        the next draw.
      </p>
    </section>
  );
}
