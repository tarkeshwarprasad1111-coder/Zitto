'use client';

import { Check, Coins as CoinsIcon, Lock, X } from 'lucide-react';
import { useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatCoins, formatOdds } from '@/lib/utils';
import { DEFAULT_PAYOUTS, QUICK_CHIP_AMOUNTS, type BetSide, type Coins, type PayoutTable } from '@/types';

const SIDES: ReadonlyArray<{
  side: BetSide;
  label: string;
  hint: string;
  active: string;
  idle: string;
}> = [
  {
    side: 'DRAGON',
    label: 'Dragon',
    hint: 'Higher card wins',
    active: 'bg-gradient-dragon text-white border-dragon-400 shadow-glow-dragon',
    idle: 'bg-dragon-500/10 text-dragon-300 border-dragon-500/35 hover:bg-dragon-500/18',
  },
  {
    side: 'TIE',
    label: 'Tie',
    hint: 'Equal ranks',
    active: 'bg-gold-500 text-surface-bg border-gold-300 shadow-glow-gold',
    idle: 'bg-gold-500/10 text-gold-300 border-gold-500/35 hover:bg-gold-500/18',
  },
  {
    side: 'TIGER',
    label: 'Tiger',
    hint: 'Higher card wins',
    active: 'bg-gradient-tiger text-white border-tiger-400 shadow-glow-tiger',
    idle: 'bg-tiger-500/10 text-tiger-300 border-tiger-500/35 hover:bg-tiger-500/18',
  },
];

export interface BetPanelProps {
  selectedSide: BetSide | null;
  onSelectSide: (side: BetSide) => void;
  amount: Coins;
  onAmountChange: (amount: Coins) => void;
  onConfirm: () => void;
  onClear: () => void;
  /** Selections are only accepted during the betting phase. */
  canBet: boolean;
  isSubmitting?: boolean;
  /** Set once the server has accepted a selection for this round. */
  confirmedSelection?: { side: BetSide; amount: Coins } | null;
  balance: Coins;
  minBet?: Coins;
  maxBet?: Coins;
  payouts?: PayoutTable;
  className?: string;
}

export function BetPanel({
  selectedSide,
  onSelectSide,
  amount,
  onAmountChange,
  onConfirm,
  onClear,
  canBet,
  isSubmitting = false,
  confirmedSelection = null,
  balance,
  minBet = 10,
  maxBet = 10_000,
  payouts = DEFAULT_PAYOUTS,
  className,
}: BetPanelProps) {
  const isLocked = !canBet || Boolean(confirmedSelection);

  const exceedsBalance = amount > balance;
  const belowMin = amount < minBet;
  const aboveMax = amount > maxBet;

  const validationMessage = exceedsBalance
    ? 'Not enough coins for this amount.'
    : belowMin
      ? `Minimum is ${formatCoins(minBet)} coins.`
      : aboveMax
        ? `Maximum is ${formatCoins(maxBet)} coins.`
        : null;

  const canConfirm =
    !isLocked && selectedSide !== null && !validationMessage && !isSubmitting && amount > 0;

  const handleAmountInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = Number.parseInt(event.target.value.replace(/\D/g, ''), 10);
      onAmountChange(Number.isNaN(parsed) ? 0 : parsed);
    },
    [onAmountChange],
  );

  const potentialReturn = selectedSide ? amount + amount * payouts[selectedSide] : 0;

  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-card p-4',
        className,
      )}
      aria-label="Place your selection"
    >
      {/* Side selection */}
      <fieldset disabled={isLocked} className="min-w-0">
        <legend className="sr-only">Choose a side</legend>
        <div className="grid grid-cols-3 gap-2">
          {SIDES.map(({ side, label, hint, active, idle }) => {
            const isSelected = selectedSide === side;
            const isConfirmed = confirmedSelection?.side === side;

            return (
              <button
                key={side}
                type="button"
                onClick={() => onSelectSide(side)}
                aria-pressed={isSelected}
                disabled={isLocked}
                className={cn(
                  'flex min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3',
                  'transition-[background-color,border-color,transform,box-shadow] duration-150 ease-spring',
                  'active:scale-[0.98] motion-reduce:active:scale-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  isSelected || isConfirmed ? active : idle,
                )}
              >
                <span className="font-display text-sm font-bold leading-none">{label}</span>
                <span className="text-2xs font-semibold tabular-nums opacity-90">
                  {formatOdds(payouts[side])}
                </span>
                <span className="text-2xs leading-tight opacity-70">{hint}</span>
                {isConfirmed ? (
                  <Check size={14} aria-hidden="true" className="mt-0.5" />
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Amount */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="bet-amount" className="text-xs font-semibold uppercase tracking-wide text-surface-muted">
            Amount
          </label>
          <span className="text-xs text-surface-muted">
            Balance <span className="font-semibold text-gold-400 tabular-nums">{formatCoins(balance)}</span>
          </span>
        </div>

        <div className="relative flex items-center">
          <CoinsIcon
            size={17}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 text-gold-400"
          />
          <input
            id="bet-amount"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount === 0 ? '' : String(amount)}
            onChange={handleAmountInput}
            disabled={isLocked}
            placeholder="0"
            aria-invalid={validationMessage ? true : undefined}
            aria-describedby={validationMessage ? 'bet-amount-error' : 'bet-amount-hint'}
            className={cn(
              'min-h-12 w-full rounded-xl border bg-surface-elevated pl-10 pr-3 font-display text-xl font-bold tabular-nums text-surface-fg',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-card',
              'disabled:cursor-not-allowed disabled:opacity-60',
              validationMessage
                ? 'border-danger-500/70 focus:ring-danger-500/60'
                : 'border-surface-border focus:border-gold-500/70 focus:ring-gold-400',
            )}
          />
        </div>

        {/* Quick chips */}
        <div className="grid grid-cols-5 gap-1.5">
          {QUICK_CHIP_AMOUNTS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onAmountChange(chip)}
              disabled={isLocked || chip > balance}
              aria-label={`Set amount to ${chip} coins`}
              className={cn(
                'min-h-11 rounded-lg border text-xs font-semibold tabular-nums',
                'transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                'disabled:cursor-not-allowed disabled:opacity-40',
                amount === chip
                  ? 'border-gold-500 bg-gold-500/20 text-gold-300'
                  : 'border-surface-border bg-surface-elevated text-surface-subtle hover:border-gold-500/50 hover:text-surface-fg',
              )}
            >
              {chip >= 1000 ? `${chip / 1000}K` : chip}
            </button>
          ))}
        </div>

        {validationMessage ? (
          <p id="bet-amount-error" role="alert" className="text-xs text-danger-400">
            {validationMessage}
          </p>
        ) : (
          <p id="bet-amount-hint" className="text-xs text-surface-muted">
            {selectedSide ? (
              <>
                Returns <span className="font-semibold tabular-nums text-surface-subtle">{formatCoins(potentialReturn)}</span>{' '}
                coins if {selectedSide.charAt(0)}
                {selectedSide.slice(1).toLowerCase()} wins. Virtual coins only — no cash value.
              </>
            ) : (
              <>
                Min {formatCoins(minBet)} · Max {formatCoins(maxBet)}. Virtual coins only — no cash
                value.
              </>
            )}
          </p>
        )}
      </div>

      {/* Actions */}
      {confirmedSelection ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-success-500/30 bg-success-500/10 px-3.5 py-3">
          <div className="flex items-center gap-2 text-sm text-success-400">
            <Check size={16} aria-hidden="true" />
            <span>
              Confirmed —{' '}
              <span className="font-semibold">
                {formatCoins(confirmedSelection.amount)} on{' '}
                {confirmedSelection.side.charAt(0)}
                {confirmedSelection.side.slice(1).toLowerCase()}
              </span>
            </span>
          </div>
          <Badge variant="success" size="sm">
            Locked
          </Badge>
        </div>
      ) : (
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            size="lg"
            onClick={onClear}
            disabled={isLocked || (selectedSide === null && amount === 0)}
            leftIcon={<X size={16} />}
            className="flex-1"
          >
            Clear
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onConfirm}
            disabled={!canConfirm}
            isLoading={isSubmitting}
            loadingText="Confirming"
            leftIcon={isLocked ? <Lock size={16} /> : <Check size={16} />}
            className="flex-[1.6]"
          >
            {isLocked ? 'Betting closed' : 'Confirm'}
          </Button>
        </div>
      )}

      {!canBet && !confirmedSelection ? (
        <p className="text-center text-xs text-surface-muted">
          Selections open again when the next round starts.
        </p>
      ) : null}
    </section>
  );
}
