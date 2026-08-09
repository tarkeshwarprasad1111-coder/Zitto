/**
 * Coin arithmetic helpers.
 *
 * Rule for the whole codebase: **coin amounts are `bigint`, never `number`.**
 * A JS number silently loses precision past 2^53 and, worse, invites accidental
 * fractional arithmetic. Coins are indivisible integers.
 *
 * At the API boundary they are serialized as decimal *strings* so JSON clients
 * (which have the same float problem) receive them losslessly.
 */

/** Parses a client-supplied coin amount. Rejects anything non-integral. */
export function parseCoins(value: unknown, field = 'amount'): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`${field} must be a safe integer number of coins.`);
    }
    return BigInt(value);
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }

  throw new TypeError(`${field} must be an integer coin amount.`);
}

/** Serializes a coin amount for JSON transport. */
export function coinsToString(value: bigint): string {
  return value.toString();
}

export function isPositive(value: bigint): boolean {
  return value > 0n;
}

export function absCoins(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/** Clamps to a range. Used for defensive bounds, not for silently fixing bad input. */
export function clampCoins(value: bigint, min: bigint, max: bigint): bigint {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Formats coins for human-facing text (audit reasons, notifications).
 * Thousands-separated, never localized to a currency — these are not money.
 */
export function formatCoins(value: bigint): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return negative ? `-${grouped}` : grouped;
}
