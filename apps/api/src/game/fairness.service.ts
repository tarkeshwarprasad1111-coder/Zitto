import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Outcome } from '@prisma/client';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';

/** A single playing card. */
export interface Card {
  /** 0–51. Suit-major: `Math.floor(index / 13)` is the suit. */
  index: number;
  /** Ace = 1 … King = 13. Dragon Tiger ranks Ace low. */
  rank: number;
  suit: 'S' | 'H' | 'D' | 'C';
  /** Canonical short code, e.g. `SA`, `H10`, `DK`. This is what is persisted. */
  code: string;
}

export interface RoundDraw {
  dragon: Card;
  tiger: Card;
  outcome: Outcome;
}

export interface FairnessProof {
  roundId: string;
  roundNumber: number;
  /** Published before betting opens. */
  serverSeedHash: string;
  /** Revealed only after settlement; null while the round is live. */
  serverSeed: string | null;
  clientSeed: string | null;
  nonce: number;
  recorded: {
    dragonCard: string | null;
    tigerCard: string | null;
    outcome: Outcome | null;
  };
  recomputed: {
    dragonCard: string;
    tigerCard: string;
    outcome: Outcome;
  } | null;
  /** True when the published hash matches the revealed seed. */
  seedMatches: boolean | null;
  /** True when replaying the seeds reproduces the recorded cards and outcome. */
  outcomeMatches: boolean | null;
  /** Overall verdict. Null while the round has not been settled. */
  verified: boolean | null;
  signature: string | null;
  signatureValid: boolean | null;
  algorithm: {
    seedHash: 'sha256';
    draw: 'hmac-sha256';
    signature: 'hmac-sha256';
    description: string;
  };
}

const SUITS: ReadonlyArray<Card['suit']> = ['S', 'H', 'D', 'C'];
const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
const DECK_SIZE = 52;

/**
 * Provable fairness.
 *
 * ## The scheme
 *
 * 1. Before betting opens the engine generates a 32-byte `serverSeed` and
 *    publishes only `sha256(serverSeed)`. It is now committed — it cannot change
 *    the seed later without breaking the hash.
 * 2. The round carries a `clientSeed` (player-influenced) and a `nonce`.
 * 3. At draw time both cards derive deterministically from
 *    `HMAC-SHA256(serverSeed, "clientSeed:nonce")`.
 * 4. After settlement the `serverSeed` is revealed. Anyone can hash it, compare
 *    against the published commitment, replay step 3, and confirm the cards were
 *    fixed before any bet was placed.
 *
 * Card selection uses **rejection sampling**, not `% 52`. A modulo over 256 would
 * make four cards very slightly likelier than the rest — a real, measurable house
 * edge over millions of rounds, and exactly the kind of thing a verifier will find.
 *
 * This service is the authority on the algorithm. The game engine draws with it;
 * the public `/game/fairness/:roundId` endpoint verifies with it.
 */
@Injectable()
export class FairnessService implements OnModuleInit {
  private readonly logger = new Logger(FairnessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.config.hasDedicatedFairnessSecret && this.config.isProduction) {
      this.logger.warn(
        'FAIRNESS_SIGNING_SECRET is not set; falling back to JWT_ACCESS_SECRET. Set a dedicated key in production.',
      );
    }
  }

  // ───────────────────────────── Primitives ─────────────────────────────

  /** 32 bytes of CSPRNG entropy, hex encoded. */
  generateSeed(): string {
    return randomBytes(32).toString('hex');
  }

  /** The public commitment to a server seed. */
  hashSeed(seed: string): string {
    return createHash('sha256').update(seed, 'utf8').digest('hex');
  }

  /** Generates a seed together with its published commitment. */
  generateCommitment(): { serverSeed: string; serverSeedHash: string } {
    const serverSeed = this.generateSeed();
    return { serverSeed, serverSeedHash: this.hashSeed(serverSeed) };
  }

  /** A client seed for rounds where the player supplied none. */
  generateClientSeed(): string {
    return randomBytes(16).toString('hex');
  }

  // ───────────────────────────── Drawing ─────────────────────────────

  /**
   * Deterministically draws both cards.
   *
   * Same inputs always produce the same output — that property is the whole point.
   */
  draw(serverSeed: string, clientSeed: string, nonce: number): RoundDraw {
    const stream = new HmacByteStream(serverSeed, `${clientSeed}:${nonce}`);

    const dragon = toCard(uniformBelow(stream, DECK_SIZE));
    const tiger = toCard(uniformBelow(stream, DECK_SIZE));

    return { dragon, tiger, outcome: decideOutcome(dragon, tiger) };
  }

  /**
   * Signs a settled round.
   *
   * The signature covers the seeds, the cards and the outcome, so a later edit to
   * any of them is detectable even by someone who cannot recompute the draw.
   */
  computeSignature(round: {
    id: string;
    roomId: string;
    roundNumber: number;
    serverSeedHash: string;
    serverSeed: string | null;
    clientSeed: string | null;
    nonce: number;
    dragonCard: string | number | null;
    tigerCard: string | number | null;
    outcome: Outcome | null;
  }): string {
    // Field order is fixed and explicit: a JSON.stringify of the row would make the
    // signature depend on property ordering, which is not a stable contract.
    const canonical = [
      round.id,
      round.roomId,
      String(round.roundNumber),
      round.serverSeedHash,
      round.serverSeed ?? '',
      round.clientSeed ?? '',
      String(round.nonce),
      normalizeCard(round.dragonCard) ?? '',
      normalizeCard(round.tigerCard) ?? '',
      round.outcome ?? '',
    ].join('|');

    return createHmac('sha256', this.config.fairnessSigningSecret)
      .update(canonical, 'utf8')
      .digest('hex');
  }

  // ───────────────────────────── Verification ─────────────────────────────

  /**
   * Rebuilds a round from its seeds and reports whether the stored result holds up.
   *
   * Public and unauthenticated by design — a fairness proof nobody can check is
   * not a fairness proof. Never throws on a mismatch; a mismatch *is* the finding,
   * and it is reported honestly.
   */
  async verifyRound(roundId: string): Promise<FairnessProof> {
    const round = await this.prisma.gameRound.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        roomId: true,
        roundNumber: true,
        serverSeed: true,
        serverSeedHash: true,
        clientSeed: true,
        nonce: true,
        dragonCard: true,
        tigerCard: true,
        outcome: true,
        fairnessSignature: true,
      },
    });

    if (!round) {
      throw new NotFoundDomainException('Round', roundId);
    }

    const algorithm = {
      seedHash: 'sha256',
      draw: 'hmac-sha256',
      signature: 'hmac-sha256',
      description:
        'dragon and tiger are drawn by rejection sampling over HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}`); the higher rank wins, equal ranks are a tie (Ace low).',
    } as const;

    const recorded = {
      dragonCard: normalizeCard(round.dragonCard),
      tigerCard: normalizeCard(round.tigerCard),
      outcome: round.outcome,
    };

    // Seed is withheld until settlement — that is correct, not a failure.
    if (!round.serverSeed) {
      return {
        roundId: round.id,
        roundNumber: round.roundNumber,
        serverSeedHash: round.serverSeedHash,
        serverSeed: null,
        clientSeed: round.clientSeed,
        nonce: round.nonce,
        recorded,
        recomputed: null,
        seedMatches: null,
        outcomeMatches: null,
        verified: null,
        signature: round.fairnessSignature,
        signatureValid: null,
        algorithm,
      };
    }

    const seedMatches = constantTimeEquals(
      this.hashSeed(round.serverSeed),
      round.serverSeedHash,
    );

    const replay = this.draw(round.serverSeed, round.clientSeed ?? '', round.nonce);

    const recomputed = {
      dragonCard: replay.dragon.code,
      tigerCard: replay.tiger.code,
      outcome: replay.outcome,
    };

    const outcomeMatches =
      recorded.dragonCard === recomputed.dragonCard &&
      recorded.tigerCard === recomputed.tigerCard &&
      recorded.outcome === recomputed.outcome;

    const expectedSignature = this.computeSignature(round);
    const signatureValid = round.fairnessSignature
      ? constantTimeEquals(expectedSignature, round.fairnessSignature)
      : null;

    const verified = seedMatches && outcomeMatches && signatureValid !== false;

    if (!verified) {
      this.logger.error(
        `Fairness verification FAILED for round ${round.id}: seedMatches=${seedMatches} outcomeMatches=${outcomeMatches} signatureValid=${String(signatureValid)}`,
      );
    }

    return {
      roundId: round.id,
      roundNumber: round.roundNumber,
      serverSeedHash: round.serverSeedHash,
      serverSeed: round.serverSeed,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      recorded,
      recomputed,
      seedMatches,
      outcomeMatches,
      verified,
      signature: round.fairnessSignature,
      signatureValid,
      algorithm,
    };
  }
}

/**
 * Expandable byte source: HMAC-SHA256 over an incrementing counter, so a caller
 * that rejects samples can never run out of entropy.
 */
class HmacByteStream {
  private buffer: Buffer;
  private offset = 0;
  private counter = 0;

  constructor(
    private readonly key: string,
    private readonly message: string,
  ) {
    this.buffer = this.block();
  }

  next(): number {
    if (this.offset >= this.buffer.length) {
      this.counter += 1;
      this.buffer = this.block();
      this.offset = 0;
    }

    // Bounds are guaranteed by the refill above; `!` documents that to the compiler
    // under noUncheckedIndexedAccess.
    const byte = this.buffer[this.offset]!;
    this.offset += 1;
    return byte;
  }

  private block(): Buffer {
    return createHmac('sha256', this.key)
      .update(this.counter === 0 ? this.message : `${this.message}:${this.counter}`, 'utf8')
      .digest();
  }
}

/**
 * Uniform integer in `[0, bound)` by rejection sampling.
 *
 * 256 is not a multiple of 52, so values at or above the largest multiple (208)
 * are discarded rather than folded in. Discarding costs an occasional extra byte;
 * folding would bias the deck.
 */
function uniformBelow(stream: HmacByteStream, bound: number): number {
  const limit = 256 - (256 % bound);

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const byte = stream.next();
    if (byte < limit) {
      return byte % bound;
    }
  }

  // Statistically unreachable: the chance of 1000 consecutive rejections is
  // (48/256)^1000. Failing loudly beats silently returning a biased value.
  throw new Error('Rejection sampling failed to converge — entropy source is broken.');
}

function toCard(index: number): Card {
  const suit = SUITS[Math.floor(index / 13)] ?? 'S';
  const rankIndex = index % 13;

  return {
    index,
    rank: rankIndex + 1,
    suit,
    code: `${suit}${RANK_LABELS[rankIndex] ?? 'A'}`,
  };
}

/** Dragon Tiger: higher rank wins, Ace low, equal ranks tie regardless of suit. */
function decideOutcome(dragon: Card, tiger: Card): Outcome {
  if (dragon.rank > tiger.rank) return Outcome.DRAGON;
  if (dragon.rank < tiger.rank) return Outcome.TIGER;
  return Outcome.TIE;
}

/**
 * Accepts either a card code (`SA`) or a 0–51 index, and returns the canonical
 * code. Tolerating both keeps verification working whichever column type the
 * schema uses.
 */
export function normalizeCard(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return toCard(((value % DECK_SIZE) + DECK_SIZE) % DECK_SIZE).code;
  }

  return value.trim().toUpperCase();
}

/** Constant-time string comparison, to avoid leaking hashes byte by byte. */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
