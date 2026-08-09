import { describe, expect, it } from 'vitest';
import {
  compare,
  deriveDraw,
  generateServerSeed,
  hashSeed,
  signRound,
} from '../fairness.js';
import { cardRank, secureRandomInt } from '../deck.js';

describe('compare', () => {
  it('ranks Ace low and King high', () => {
    expect(compare('KS', 'AH')).toBe('DRAGON');
    expect(compare('AS', 'KH')).toBe('TIGER');
  });

  it('ignores suit when ranks match', () => {
    expect(compare('7S', '7H')).toBe('TIE');
    expect(compare('QD', 'QC')).toBe('TIE');
  });
});

describe('deriveDraw', () => {
  it('is deterministic for the same seeds and nonce', () => {
    const seed = generateServerSeed();
    const first = deriveDraw(seed, 'client-abc', 1);
    const second = deriveDraw(seed, 'client-abc', 1);
    expect(first).toEqual(second);
  });

  it('changes when the nonce changes', () => {
    const seed = generateServerSeed();
    const draws = new Set(
      Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(deriveDraw(seed, 'client', i)),
      ),
    );
    // Collisions are possible but 20 identical draws would signal a bug.
    expect(draws.size).toBeGreaterThan(1);
  });

  it('never deals the same card to both sides', () => {
    const seed = generateServerSeed();
    for (let nonce = 0; nonce < 200; nonce += 1) {
      const draw = deriveDraw(seed, 'client', nonce);
      expect(draw.dragonCard).not.toBe(draw.tigerCard);
    }
  });

  it('reports the outcome its own cards imply', () => {
    const seed = generateServerSeed();
    for (let nonce = 0; nonce < 200; nonce += 1) {
      const { dragonCard, tigerCard, outcome } = deriveDraw(seed, 'c', nonce);
      const expected =
        cardRank(dragonCard) > cardRank(tigerCard) ? 'DRAGON'
        : cardRank(tigerCard) > cardRank(dragonCard) ? 'TIGER'
        : 'TIE';
      expect(outcome).toBe(expected);
    }
  });

  it('produces all three outcomes over many rounds', () => {
    const seed = generateServerSeed();
    const seen = new Set(
      Array.from({ length: 500 }, (_, i) => deriveDraw(seed, 'c', i).outcome),
    );
    expect(seen.has('DRAGON')).toBe(true);
    expect(seen.has('TIGER')).toBe(true);
    expect(seen.has('TIE')).toBe(true);
  });
});

describe('seed commitment', () => {
  it('hashes the seed to a stable 64-char digest', () => {
    const seed = generateServerSeed();
    expect(hashSeed(seed)).toHaveLength(64);
    expect(hashSeed(seed)).toBe(hashSeed(seed));
  });

  it('produces a different hash for a different seed', () => {
    expect(hashSeed(generateServerSeed())).not.toBe(
      hashSeed(generateServerSeed()),
    );
  });

  it('lets an outside party replay the published proof', () => {
    const serverSeed = generateServerSeed();
    const published = hashSeed(serverSeed);
    const draw = deriveDraw(serverSeed, 'client-seed', 42);

    // What a verifier does after the seed is revealed.
    expect(hashSeed(serverSeed)).toBe(published);
    expect(deriveDraw(serverSeed, 'client-seed', 42)).toEqual(draw);
  });
});

describe('signRound', () => {
  it('changes if any field of the settled round changes', () => {
    const base = {
      roundId: 'r1',
      serverSeed: 'seed',
      clientSeed: 'client',
      nonce: 1,
      dragonCard: 'KS',
      tigerCard: '3H',
      outcome: 'DRAGON' as const,
    };
    const signature = signRound(base, 'key');

    expect(signRound({ ...base, outcome: 'TIGER' }, 'key')).not.toBe(signature);
    expect(signRound({ ...base, dragonCard: '2S' }, 'key')).not.toBe(signature);
    expect(signRound(base, 'other-key')).not.toBe(signature);
  });
});

describe('secureRandomInt', () => {
  it('stays within range', () => {
    for (let i = 0; i < 1000; i += 1) {
      const value = secureRandomInt(52);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(52);
    }
  });

  it('rejects invalid bounds', () => {
    expect(() => secureRandomInt(0)).toThrow();
    expect(() => secureRandomInt(-1)).toThrow();
    expect(() => secureRandomInt(1.5)).toThrow();
  });
});
