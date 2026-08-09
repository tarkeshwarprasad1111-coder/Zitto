'use client';

import { useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

export interface CountdownTimerProps {
  /** Whole seconds remaining. */
  seconds: number;
  /** Total seconds in this phase, used to fill the ring. */
  totalSeconds: number;
  size?: number;
  strokeWidth?: number;
  /** Short caption under the number, e.g. "Betting closes in". */
  label?: string;
  className?: string;
}

/**
 * Circular countdown ring.
 *
 * The colour shifts from gold to amber to red as time runs out, and the
 * number pulses in the final five seconds — but colour is never the only
 * signal, since the digits and the ring arc both carry the same information.
 */
export function CountdownTimer({
  seconds,
  totalSeconds,
  size = 96,
  strokeWidth = 6,
  label,
  className,
}: CountdownTimerProps) {
  const prefersReducedMotion = useReducedMotion();

  const safeTotal = totalSeconds > 0 ? totalSeconds : 1;
  const clamped = Math.max(0, Math.min(seconds, safeTotal));
  const progress = clamped / safeTotal;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const urgency = clamped <= 3 ? 'critical' : clamped <= 5 ? 'urgent' : progress <= 0.35 ? 'low' : 'normal';

  const ringColor =
    urgency === 'critical' || urgency === 'urgent'
      ? '#EF4444'
      : urgency === 'low'
        ? '#F59E0B'
        : '#FBBF24';

  const textColor =
    urgency === 'critical' || urgency === 'urgent'
      ? 'text-danger-400'
      : urgency === 'low'
        ? 'text-gold-400'
        : 'text-surface-fg';

  return (
    <div
      className={cn('relative inline-flex flex-col items-center justify-center', className)}
      role="timer"
      aria-live={urgency === 'critical' ? 'assertive' : 'off'}
      aria-label={`${clamped} seconds remaining${label ? `. ${label}` : ''}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} aria-hidden="true" className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(42 42 56)"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: prefersReducedMotion
                ? 'none'
                : 'stroke-dashoffset 250ms linear, stroke 300ms ease',
              filter: urgency === 'critical' ? `drop-shadow(0 0 6px ${ringColor})` : undefined,
            }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <span
            key={clamped}
            className={cn(
              'font-display text-3xl font-bold tabular-nums',
              textColor,
              urgency === 'critical' && !prefersReducedMotion && 'animate-count-tick',
            )}
            style={{ fontSize: size * 0.32 }}
          >
            {clamped}
          </span>
        </div>
      </div>

      {label ? (
        <p className="mt-2 text-center text-xs font-medium uppercase tracking-wide text-surface-muted">
          {label}
        </p>
      ) : null}
    </div>
  );
}
