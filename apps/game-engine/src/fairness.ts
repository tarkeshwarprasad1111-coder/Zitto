import { createHash, createHmac, randomBytes } from 'node:crypto';
import { buildDeck, cardRank, type Card } from './deck.js';

export type Outcome = 'DRAGON' | 'TIGER' | 'TIE';

export interface RoundDraw {
  dragonCard: Card;
  tigerCard: Card;
  outcome: Outcome;
}

export function generateServerSeed(): string {
  return randomBytes(32).toString('hex');
}

export function hashSeed(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

/**
 * Derives the two cards deterministically from the committed seeds.
 * Publishing serverSeedHash before the round and serverSeed after it
 * lets anyone replay this function and confirm the result was not
 * changed after bets were placed.
 */
export function deriveDraw(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): RoundDraw {
  const deck = buildDeck();
  const dragonCard = pickCard(deck, serverSeed, clientSeed, nonce, 'dragon');
  const remaining = deck.filter((card) => card !== dragonCard);
  const tigerCard = pickCard(remaining, serverSeed, clientSeed, nonce, 'tiger');

  return { dragonCard, tigerCard, outcome: compare(dragonCard, tigerCard) };
}

function pickCard(
  pool: Card[],
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  label: string,
): Card {
  const digest = createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}:${label}`)
    .digest();

  // Rejection sampling over 4-byte windows keeps the pick uniform.
  const limit = 2 ** 32 - (2 ** 32 % pool.length);
  for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
    const value = digest.readUInt32BE(offset);
    if (value < limit) {
      return pool[value % pool.length]!;
    }
  }

  // Every window was rejected — rehash with a counter and try again.
  const rehashed = createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}:${label}:retry`)
    .digest();
  return pool[rehashed.readUInt32BE(0) % pool.length]!;
}

export function compare(dragonCard: Card, tigerCard: Card): Outcome {
  const dragon = cardRank(dragonCard);
  const tiger = cardRank(tigerCard);
  if (dragon > tiger) return 'DRAGON';
  if (tiger > dragon) return 'TIGER';
  return 'TIE';
}

/**
 * Signs the settled round so any later mutation of the stored row is
 * detectable. The key lives only in the game-engine environment.
 */
export function signRound(
  input: {
    roundId: string;
    serverSeed: string;
    clientSeed: string;
    nonce: number;
    dragonCard: string;
    tigerCard: string;
    outcome: Outcome;
  },
  key: string,
): string {
  const payload = [
    input.roundId,
    input.serverSeed,
    input.clientSeed,
    String(input.nonce),
    input.dragonCard,
    input.tigerCard,
    input.outcome,
  ].join('|');
  return createHmac('sha256', key).update(payload).digest('hex');
}

export function verifyRound(
  input: Parameters<typeof signRound>[0],
  key: string,
  signature: string,
): boolean {
  const expected = signRound(input, key);
  // Length check first so timingSafeEqual never throws on mismatched sizes.
  if (expected.length !== signature.length) return false;
  return createHmac('sha256', key).update(expected).digest('hex') ===
    createHmac('sha256', key).update(signature).digest('hex');
}
