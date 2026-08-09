import type { Outcome } from './fairness.js';

export interface PayoutTable {
  dragon: number;
  tiger: number;
  tie: number;
  /** Fraction of a Dragon/Tiger stake returned when the round ties. */
  tieRefundRatio: number;
}

export const DEFAULT_PAYOUTS: PayoutTable = {
  dragon: 1,
  tiger: 1,
  tie: 8,
  tieRefundRatio: 0.5,
};

export type BetResult = 'WON' | 'LOST' | 'REFUNDED';

export interface SettledBet {
  result: BetResult;
  /** Total coins returned to the wallet, stake included. */
  payout: bigint;
}

/**
 * House rule: a tie returns half of a Dragon/Tiger stake rather than
 * taking the whole thing. Displayed on the rules modal so the player
 * sees it before betting.
 */
export function settleBet(
  side: Outcome,
  amount: bigint,
  outcome: Outcome,
  payouts: PayoutTable = DEFAULT_PAYOUTS,
): SettledBet {
  if (amount <= 0n) {
    throw new Error('Bet amount must be positive');
  }

  if (side === outcome) {
    const multiplier =
      outcome === 'TIE' ? payouts.tie
      : outcome === 'DRAGON' ? payouts.dragon
      : payouts.tiger;
    return { result: 'WON', payout: amount + amount * BigInt(multiplier) };
  }

  if (outcome === 'TIE') {
    const numerator = BigInt(Math.round(payouts.tieRefundRatio * 100));
    return { result: 'REFUNDED', payout: (amount * numerator) / 100n };
  }

  return { result: 'LOST', payout: 0n };
}

export function describePayouts(payouts: PayoutTable = DEFAULT_PAYOUTS): string[] {
  return [
    `Dragon wins: ${payouts.dragon}:1`,
    `Tiger wins: ${payouts.tiger}:1`,
    `Tie: ${payouts.tie}:1`,
    `On a tie, Dragon and Tiger stakes return ${payouts.tieRefundRatio * 100}%`,
  ];
}
