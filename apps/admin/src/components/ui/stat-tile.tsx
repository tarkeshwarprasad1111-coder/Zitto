import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatPercent } from '@/lib/utils';

export interface StatTileProps {
  label: string;
  /** Pre-formatted. Callers own the units so the tile stays presentational. */
  value: React.ReactNode;
  /** Period-over-period change as a 0–1 ratio. `null` hides the delta. */
  delta?: number | null;
  /** Label for the comparison window, e.g. `vs. yesterday`. */
  deltaLabel?: string;
  /**
   * Whether an increase is good. Open tickets and fraud alerts going up is
   * bad, so those tiles pass `false` and the arrow colours invert.
   */
  higherIsBetter?: boolean;
  icon?: React.ReactNode;
  /** Tints the whole tile — reserve for values that need attention now. */
  tone?: 'default' | 'warning' | 'danger';
  hint?: string;
  isLoading?: boolean;
  className?: string;
}

const toneStyles = {
  default: 'border-surface-border bg-surface-card',
  warning: 'border-warning-500/30 bg-warning-500/[0.05]',
  danger: 'border-danger-500/30 bg-danger-500/[0.05]',
} as const;

const iconToneStyles = {
  default: 'bg-surface-elevated text-surface-muted',
  warning: 'bg-warning-500/12 text-warning-400',
  danger: 'bg-danger-500/12 text-danger-400',
} as const;

export function StatTile({
  label,
  value,
  delta = null,
  deltaLabel,
  higherIsBetter = true,
  icon,
  tone = 'default',
  hint,
  isLoading = false,
  className,
}: StatTileProps) {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label={`Loading ${label}`}
        className={cn('rounded-lg border p-4', toneStyles[tone], className)}
      >
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-32" />
        <Skeleton className="mt-3 h-3 w-20" />
      </div>
    );
  }

  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const rising = hasDelta && delta > 0;
  const flat = hasDelta && delta === 0;
  const good = hasDelta ? (higherIsBetter ? delta > 0 : delta < 0) : false;

  const DeltaIcon = flat ? Minus : rising ? TrendingUp : TrendingDown;

  return (
    <div className={cn('rounded-lg border p-4 shadow-card', toneStyles[tone], className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-surface-muted">{label}</p>
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded',
              iconToneStyles[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-2xl font-semibold leading-none tabular-nums text-surface-fg">
        {value}
      </p>

      {hasDelta || hint ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {hasDelta ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium tabular-nums',
                flat ? 'text-surface-muted' : good ? 'text-success-400' : 'text-danger-400',
              )}
            >
              <DeltaIcon size={13} aria-hidden="true" />
              {formatPercent(Math.abs(delta), 1)}
            </span>
          ) : null}
          {deltaLabel ? <span className="text-xs text-surface-muted">{deltaLabel}</span> : null}
          {hint ? <span className="text-xs text-surface-muted">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
