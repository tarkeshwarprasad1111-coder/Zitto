import { randomBytes } from 'node:crypto';

export const SUITS = ['S', 'H', 'D', 'C'] as const;
export const RANKS = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
export type Card = `${Rank}${Suit}`;

/**
 * Dragon Tiger ranks Ace low through King high.
 * Suit never affects the comparison — only rank does.
 */
export const RANK_VALUE: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
};

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}` as Card);
    }
  }
  return deck;
}

export function cardRank(card: Card): number {
  const rank = card.slice(0, -1) as Rank;
  const value = RANK_VALUE[rank];
  if (value === undefined) {
    throw new Error(`Unknown card rank in "${card}"`);
  }
  return value;
}

/**
 * Draws an unbiased index in [0, max) from the OS CSPRNG using
 * rejection sampling, so no modulo bias creeps into the outcome.
 */
export function secureRandomInt(max: number): number {
  if (max <= 0 || !Number.isInteger(max)) {
    throw new Error('max must be a positive integer');
  }
  const range = 2 ** 32;
  const limit = range - (range % max);
  for (;;) {
    const value = randomBytes(4).readUInt32BE(0);
    if (value < limit) return value % max;
  }
}

export function drawTwoDistinct(deck: Card[]): [Card, Card] {
  const pool = [...deck];
  const first = pool.splice(secureRandomInt(pool.length), 1)[0]!;
  const second = pool.splice(secureRandomInt(pool.length), 1)[0]!;
  return [first, second];
}
