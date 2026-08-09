'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { PlayingCard } from '@/components/game/playing-card';
import { Button } from '@/components/ui/button';
import { cn, formatCoins, outcomeLabel, OUTCOME_STYLES } from '@/lib/utils';
import type { RoundResultSummary } from '@/types';

export interface ResultOverlayProps {
  open: boolean;
  result: RoundResultSummary | null;
  /** Seconds until the next round begins. */
  nextRoundInSeconds: number;
  onDismiss: () => void;
  className?: string;
}

/**
 * Full-screen round result.
 *
 * Wins are celebrated proportionally, losses are stated plainly — no
 * "recover it next round" nudge, no loss-chasing language.
 */
export function ResultOverlay({
  open,
  result,
  nextRoundInSeconds,
  onDismiss,
  className,
}: ResultOverlayProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!result) return null;

  const selection = result.yourSelection;
  const didPlay = Boolean(selection);
  const didWin = selection?.status === 'won';
  const payout = selection?.payout ?? 0;
  const stake = selection?.amount ?? 0;
  const net = didWin ? payout - stake : -stake;

  const styles = OUTCOME_STYLES[result.outcome];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Round ${result.roundNumber} result: ${outcomeLabel(result.outcome)}`}
          className={cn(
            'fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-surface-bg/92 px-6 backdrop-blur-md',
            className,
          )}
        >
          {/* Outcome banner */}
          <motion.div
            initial={prefersReducedMotion ? false : { scale: 0.86, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-1.5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-surface-muted">
              Round #{result.roundNumber}
            </p>
            <h2
              className={cn(
                'font-display text-4xl font-extrabold tracking-tight sm:text-5xl',
                styles.text,
              )}
            >
              {result.outcome === 'TIE' ? 'Tie' : `${outcomeLabel(result.outcome)} wins`}
            </h2>
          </motion.div>

          {/* Cards */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex flex-col items-center gap-2">
              <PlayingCard
                card={result.dragonCard}
                size="lg"
                side="DRAGON"
                isWinner={result.outcome === 'DRAGON'}
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-dragon-400">
                Dragon
              </span>
            </div>

            <span aria-hidden="true" className="font-display text-xl text-surface-muted">
              vs
            </span>

            <div className="flex flex-col items-center gap-2">
              <PlayingCard
                card={result.tigerCard}
                size="lg"
                side="TIGER"
                isWinner={result.outcome === 'TIGER'}
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-tiger-400">
                Tiger
              </span>
            </div>
          </div>

          {/* Player result */}
          {didPlay ? (
            <motion.div
              initial={prefersReducedMotion ? false : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className={cn(
                'flex w-full max-w-xs flex-col items-center gap-1 rounded-2xl border px-5 py-4 text-center',
                didWin
                  ? 'border-success-500/35 bg-success-500/10'
                  : 'border-surface-border bg-surface-card',
              )}
            >
              <span
                className={cn(
                  'flex items-center gap-1.5 text-sm font-semibold',
                  didWin ? 'text-success-400' : 'text-surface-muted',
                )}
              >
                {didWin ? (
                  <TrendingUp size={16} aria-hidden="true" />
                ) : net === 0 ? (
                  <Minus size={16} aria-hidden="true" />
                ) : (
                  <TrendingDown size={16} aria-hidden="true" />
                )}
                {didWin ? 'You won' : selection?.status === 'refunded' ? 'Refunded' : 'Not this time'}
              </span>

              <span
                className={cn(
                  'font-display text-3xl font-bold tabular-nums',
                  didWin ? 'text-gold-400' : 'text-surface-subtle',
                )}
              >
                {formatCoins(net, { signed: true })}
              </span>

              <span className="text-xs text-surface-muted">
                {formatCoins(stake)} on {outcomeLabel(selection!.side)}
                {didWin ? ` · returned ${formatCoins(payout)}` : ''}
              </span>
            </motion.div>
          ) : (
            <p className="text-sm text-surface-muted">You sat this round out.</p>
          )}

          {/* Next round */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-surface-muted" aria-live="polite">
              Next round in{' '}
              <span className="font-semibold tabular-nums text-surface-fg">
                {Math.max(0, nextRoundInSeconds)}s
              </span>
            </p>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>

          <p className="max-w-xs text-center text-2xs leading-relaxed text-surface-muted">
            Every round is independent. Historical patterns do not determine future outcomes.
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
