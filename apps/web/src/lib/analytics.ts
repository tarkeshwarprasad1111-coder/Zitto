import {
  INDEPENDENCE_DISCLAIMER,
  type AnalyticsSummary,
  type AnalyticsWindow,
  type BetSide,
  type Coins,
  type ConfidenceLabel,
  type ISODateString,
  type Outcome,
  type PredictionEstimate,
  type StreakInfo,
} from '@/types';

/**
 * Analytics computed from rounds the player actually played.
 *
 * Everything here is a pure function over a list of settled rounds, which is
 * what lets the same code serve the offline build (rounds from the local
 * store) and a future online one (rounds from `GET /analytics/summary`).
 *
 * The confidence ceiling is the important rule: no sample size may produce
 * anything above "Moderate signal", because Dragon Tiger rounds are
 * independent draws and a stronger label would be a claim the data cannot
 * support.
 */

/** One settled round as the client records it. Trimmed for storage. */
export interface PlayedRound {
  outcome: Outcome;
  settledAt: ISODateString;
  /** The side backed on this round, or null when the player sat it out. */
  side: BetSide | null;
  /** Stake. Zero when there was no selection. */
  amount: Coins;
  /** Total returned to the balance. Zero on a loss or a sit-out. */
  payout: Coins;
}

/** Below this many rounds no figure is worth showing at all. */
export const MIN_SAMPLE = 10;

/** At or above this, the strongest label available. Never stronger. */
const MODERATE_SAMPLE = 50;

/** A lean smaller than this is noise, not a tendency. */
const MIN_LEAN = 0.04;

/** The gap that has to open up before a lean earns the top label. */
const MODERATE_LEAN = 0.12;

export function computeStreak(history: readonly Outcome[]): StreakInfo {
  if (history.length === 0) {
    return { side: null, length: 0, longestInWindow: 0, longestSide: null };
  }

  const current = history[0]!;
  let length = 1;
  while (length < history.length && history[length] === current) length += 1;

  let longestInWindow = 1;
  let longestSide: Outcome | null = current;
  let runSide = current;
  let runLength = 1;

  for (let i = 1; i < history.length; i += 1) {
    if (history[i] === runSide) {
      runLength += 1;
    } else {
      runSide = history[i]!;
      runLength = 1;
    }

    if (runLength > longestInWindow) {
      longestInWindow = runLength;
      longestSide = runSide;
    }
  }

  return {
    // A "streak" of one is just the last round; reporting it as a streak
    // invites reading a pattern into a single draw.
    side: length > 1 ? current : null,
    length: length > 1 ? length : 0,
    longestInWindow,
    longestSide,
  };
}

/**
 * Rolls the player's own rounds up into the shape the analytics cards expect.
 *
 * `rounds` must be newest-first, which is how the store keeps them.
 */
export function summarisePlayedRounds(
  rounds: readonly PlayedRound[],
  window: AnalyticsWindow,
): AnalyticsSummary {
  const slice = rounds.slice(0, window);
  const counts = { DRAGON: 0, TIGER: 0, TIE: 0 };

  for (const round of slice) counts[round.outcome] += 1;

  const sampleSize = slice.length;
  const share = (value: number): number => (sampleSize === 0 ? 0 : value / sampleSize);

  const newest = slice[0]?.settledAt;
  const oldest = slice[slice.length - 1]?.settledAt;
  const now = new Date().toISOString();

  return {
    sampleSize,
    window,
    method:
      sampleSize === 0
        ? 'No rounds recorded on this device yet.'
        : `Rolling frequency count over the last ${sampleSize} rounds you played on this device. Each round counted once, no weighting applied.`,
    lastUpdated: now,
    counts,
    frequencies: {
      DRAGON: share(counts.DRAGON),
      TIGER: share(counts.TIGER),
      TIE: share(counts.TIE),
    },
    tieRate: share(counts.TIE),
    streak: computeStreak(slice.map((r) => r.outcome)),
    periodStart: oldest ?? now,
    periodEnd: newest ?? now,
  };
}

/**
 * The model estimate.
 *
 * It reports which side has come up more often and how confident that
 * observation is — never what the next round will be. `estimatedSide` is null
 * whenever the two sides are within {@link MIN_LEAN} of each other, which is
 * most of the time, because that is what an honest reading of a fair game
 * looks like.
 */
export function predictFromPlayedRounds(
  rounds: readonly PlayedRound[],
  window: AnalyticsWindow,
): PredictionEstimate {
  const summary = summarisePlayedRounds(rounds, window);
  const { DRAGON, TIGER } = summary.frequencies;
  const { sampleSize } = summary;

  const gap = Math.abs(DRAGON - TIGER);
  const lean: Outcome | null =
    sampleSize < MIN_SAMPLE || gap < MIN_LEAN ? null : DRAGON > TIGER ? 'DRAGON' : 'TIGER';

  let confidenceLabel: ConfidenceLabel;
  if (lean === null || sampleSize < 25) {
    confidenceLabel = 'No reliable signal';
  } else if (sampleSize >= MODERATE_SAMPLE && gap > MODERATE_LEAN) {
    confidenceLabel = 'Moderate signal';
  } else {
    confidenceLabel = 'Low confidence';
  }

  return {
    modelCode: `freq_rolling_${window}`,
    modelVersion: '1.4.0',
    estimatedSide: lean,
    probability: lean === 'DRAGON' ? DRAGON : lean === 'TIGER' ? TIGER : 0.5,
    confidenceLabel,
    sampleSize,
    window,
    method:
      sampleSize === 0
        ? 'Nothing to compare yet — play a few rounds and this fills in.'
        : `Rolling frequency model. Compares observed Dragon and Tiger rates across the last ${sampleSize} rounds you played. No card-counting or seed inspection is involved.`,
    // Honest null rather than a borrowed figure: this device has not tracked
    // the model against enough outcomes to publish an accuracy, and inventing
    // one would be the exact overstatement the disclaimer warns about.
    historicalAccuracy: null,
    accuracySampleSize: sampleSize,
    disclaimer: INDEPENDENCE_DISCLAIMER,
    lastUpdated: summary.lastUpdated,
  };
}

/** Net coins won or lost across the analysed rounds. Negative means down. */
export function sessionNet(rounds: readonly PlayedRound[], window: AnalyticsWindow): Coins {
  return rounds
    .slice(0, window)
    .reduce((total, round) => total + round.payout - round.amount, 0);
}

/** How many of the analysed rounds the player actually staked on. */
export function roundsStaked(rounds: readonly PlayedRound[], window: AnalyticsWindow): number {
  return rounds.slice(0, window).filter((round) => round.side !== null).length;
}
