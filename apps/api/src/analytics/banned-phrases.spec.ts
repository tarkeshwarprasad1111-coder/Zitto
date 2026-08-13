import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { assertNoBannedPhrases } from './analytics.service';
import { BANNED_PREDICTION_PHRASES } from './prohibited-phrases';

/**
 * `packages/contracts` is the canonical list, but it is an ESM package and this
 * app compiles to CommonJS, so the API keeps its own copy. That duplication is
 * only safe while something notices when the two drift — this file is that
 * something. Reading the source text avoids importing across the module-system
 * boundary.
 *
 * Delete this in favour of a real import once `@zitto/contracts` ships a dual
 * build.
 */
function canonicalPhrases(): string[] {
  const source = readFileSync(
    join(__dirname, '../../../../packages/contracts/src/disclaimers.ts'),
    'utf8',
  );

  const block = source.match(/PROHIBITED_PHRASES\s*=\s*\[([\s\S]*?)\]/);
  if (!block?.[1]) {
    throw new Error('Could not find PROHIBITED_PHRASES in packages/contracts.');
  }

  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

describe('banned prediction phrases', () => {
  it('matches the canonical list in packages/contracts', () => {
    expect([...BANNED_PREDICTION_PHRASES].sort()).toEqual(canonicalPhrases().sort());
  });

  it('rejects text that overstates what the model can do', () => {
    expect(() => assertNoBannedPhrases('This model is 100% accurate.')).toThrow();
    expect(() => assertNoBannedPhrases('A guaranteed win every time')).toThrow();
    expect(() => assertNoBannedPhrases('Follow this to recover your loss')).toThrow();
  });

  it('is case insensitive', () => {
    expect(() => assertNoBannedPhrases('GUARANTEED PROFIT')).toThrow();
  });

  /**
   * The reason the list is phrases rather than words. Each of these is a true
   * statement an operator has a legitimate reason to write, and an earlier
   * word-level list rejected all of them.
   */
  it('allows accurate statements that contain a flagged word', () => {
    expect(() => assertNoBannedPhrases('100% of rounds are drawn independently.')).not.toThrow();
    expect(() => assertNoBannedPhrases('Every action is guaranteed to be logged.')).not.toThrow();
    expect(() =>
      assertNoBannedPhrases('The window is fixed at 50 rounds; results are not.'),
    ).not.toThrow();
    expect(() =>
      assertNoBannedPhrases('Counts how often each side came up. Past rounds only.'),
    ).not.toThrow();
  });
});
