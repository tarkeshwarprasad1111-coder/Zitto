/**
 * Single source of truth for the language the product is allowed to use when
 * describing analytics. The CI guardrail scans for the banned list; the
 * confidence labels below are the only ones any surface may render.
 */

export const INDEPENDENCE_DISCLAIMER =
  'Every round is independent. Historical patterns do not determine future outcomes.';

export const VIRTUAL_COIN_DISCLAIMER =
  'Virtual coins have no cash value. They cannot be purchased, exchanged, or withdrawn.';

export const ANALYTICS_SCOPE_DISCLAIMER =
  'These figures describe rounds that have already been played. They are not a forecast.';

/**
 * Confidence deliberately tops out at "Moderate signal". There is no high
 * confidence tier, because no sample size would justify one for an
 * independent-trial game.
 */
export const CONFIDENCE_LABELS = [
  'No reliable signal',
  'Low confidence',
  'Moderate signal',
] as const;

export type ConfidenceLabel = (typeof CONFIDENCE_LABELS)[number];

export const CONFIDENCE_THRESHOLDS = {
  /** Below this many rounds, report no signal at all. */
  noSignalBelow: 30,
  /** At or above this, the strongest label available. */
  moderateAtOrAbove: 100,
} as const;

export function confidenceForSample(sampleSize: number): ConfidenceLabel {
  if (sampleSize < CONFIDENCE_THRESHOLDS.noSignalBelow) {
    return 'No reliable signal';
  }
  if (sampleSize < CONFIDENCE_THRESHOLDS.moderateAtOrAbove) {
    return 'Low confidence';
  }
  return 'Moderate signal';
}

/**
 * Phrases that misrepresent what the analytics can do. CI greps for these
 * across apps/ and packages/ and fails the build on a match.
 */
export const PROHIBITED_PHRASES = [
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

export function containsProhibitedLanguage(text: string): string | null {
  const haystack = text.toLowerCase();
  return PROHIBITED_PHRASES.find((phrase) => haystack.includes(phrase)) ?? null;
}
