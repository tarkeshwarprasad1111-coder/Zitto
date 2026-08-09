import { describe, expect, it } from 'vitest';
import { DEFAULT_PAYOUTS, settleBet } from '../payout.js';

describe('settleBet', () => {
  it('returns stake plus 1:1 when Dragon is backed and Dragon wins', () => {
    expect(settleBet('DRAGON', 100n, 'DRAGON')).toEqual({
      result: 'WON',
      payout: 200n,
    });
  });

  it('returns stake plus 1:1 when Tiger is backed and Tiger wins', () => {
    expect(settleBet('TIGER', 250n, 'TIGER')).toEqual({
      result: 'WON',
      payout: 500n,
    });
  });

  it('pays 8:1 on a backed tie', () => {
    expect(settleBet('TIE', 100n, 'TIE')).toEqual({
      result: 'WON',
      payout: 900n,
    });
  });

  it('refunds half the stake when a Dragon bet meets a tie', () => {
    expect(settleBet('DRAGON', 100n, 'TIE')).toEqual({
      result: 'REFUNDED',
      payout: 50n,
    });
  });

  it('pays nothing when the backed side loses outright', () => {
    expect(settleBet('DRAGON', 100n, 'TIGER')).toEqual({
      result: 'LOST',
      payout: 0n,
    });
    expect(settleBet('TIE', 100n, 'DRAGON')).toEqual({
      result: 'LOST',
      payout: 0n,
    });
  });

  it('rejects non-positive stakes', () => {
    expect(() => settleBet('DRAGON', 0n, 'DRAGON')).toThrow();
    expect(() => settleBet('DRAGON', -5n, 'DRAGON')).toThrow();
  });

  it('rounds the tie refund down so the house never overpays', () => {
    // 25 * 50 / 100 = 12.5 -> floor to 12
    expect(settleBet('TIGER', 25n, 'TIE').payout).toBe(12n);
  });

  it('handles large stakes without precision loss', () => {
    const huge = 9_007_199_254_740_993n; // beyond Number.MAX_SAFE_INTEGER
    expect(settleBet('DRAGON', huge, 'DRAGON').payout).toBe(huge * 2n);
  });

  it('honours a custom payout table', () => {
    const table = { ...DEFAULT_PAYOUTS, tie: 10, tieRefundRatio: 1 };
    expect(settleBet('TIE', 100n, 'TIE', table).payout).toBe(1100n);
    expect(settleBet('DRAGON', 100n, 'TIE', table).payout).toBe(100n);
  });
});
