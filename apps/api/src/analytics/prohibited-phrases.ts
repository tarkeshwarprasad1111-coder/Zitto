/**
 * Claims the product may not make about its own analytics.
 *
 * This file exists on its own so the CI scanner can skip exactly one path.
 * The scanner greps the repo for these phrases; a file that has to *contain*
 * them in order to ban them will always match, and burying the list inside a
 * service would force the exclusion to cover real logic too.
 *
 * MUST stay identical to `PROHIBITED_PHRASES` in `packages/contracts`.
 * `banned-phrases.spec.ts` fails if the two drift. The duplication is
 * temporary: contracts is ESM and this app compiles to CommonJS, so it cannot
 * be imported here until that package ships a dual build.
 *
 * Every entry is a multi-word phrase, deliberately. Matching bare words like
 * "guaranteed" or "100%" rejects sentences that are true and worth saying —
 * "100% of rounds are drawn independently" — which teaches authors to work
 * around the check rather than heed it.
 */
export const BANNED_PREDICTION_PHRASES = [
  'guaranteed win',
  'guaranteed profit',
  'sure shot',
  'sure prediction',
  '100% accurate',
  '100% win',
  'fixed result',
  'double your money',
  'recover your loss',
] as const;

export type BannedPhrase = (typeof BANNED_PREDICTION_PHRASES)[number];

/** The phrase found, or null when the text is clean. */
export function findBannedPhrase(text: string): BannedPhrase | null {
  const haystack = text.toLowerCase();
  return BANNED_PREDICTION_PHRASES.find((phrase) => haystack.includes(phrase)) ?? null;
}
