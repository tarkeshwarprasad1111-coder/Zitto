import { BadRequestException, Injectable } from '@nestjs/common';
import { Outcome } from '@prisma/client';
import { ANALYTICS_DISCLAIMER, CONFIDENCE_THRESHOLD, REDIS_KEY } from '../common/constants';
import { BANNED_PREDICTION_PHRASES, findBannedPhrase } from './prohibited-phrases';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type ConfidenceLabel = 'insufficient_data' | 'none' | 'low' | 'moderate';

export interface AnalyticsMeta {
  windowRounds: number;
  sampleSize: number;
  method: string;
  confidence: ConfidenceLabel;
  dataQuality: 'good' | 'sparse' | 'insufficient';
  computedAt: string;
  disclaimer: string; // always populated
}

function buildMeta(window: number, sampleSize: number): AnalyticsMeta {
  const confidence: ConfidenceLabel =
    sampleSize < 10
      ? 'insufficient_data'
      : sampleSize < CONFIDENCE_THRESHOLD.LOW
        ? 'none'
        : sampleSize < CONFIDENCE_THRESHOLD.MODERATE
          ? 'low'
          : 'moderate';

  const dataQuality =
    sampleSize < 10 ? 'insufficient' : sampleSize < window * 0.5 ? 'sparse' : 'good';

  return {
    windowRounds: window,
    sampleSize,
    method: 'Rolling frequency (last N settled rounds)',
    confidence,
    dataQuality,
    computedAt: new Date().toISOString(),
    disclaimer: ANALYTICS_DISCLAIMER,
  };
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getSummary(userId: string, window: number) {
    const cacheKey = REDIS_KEY.analyticsUserSummary(window, userId);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as ReturnType<typeof this._computeSummary>;

    const result = await this._computeSummary(userId, window);
    await this.redis.set(cacheKey, JSON.stringify(result), 60);
    return result;
  }

  private async _computeSummary(userId: string, window: number, roomId?: string) {
    const rounds = await this.prisma.betSelection.findMany({
      where: {
        userId,
        status: { not: 'PLACED' },
        ...(roomId ? { round: { roomId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: window,
      select: { round: { select: { outcome: true } } },
    });

    const outcomes = rounds.map((b) => b.round.outcome).filter(Boolean) as Outcome[];
    const counts = { DRAGON: 0, TIGER: 0, TIE: 0 };
    for (const o of outcomes) counts[o]++;

    const total = outcomes.length;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : null);

    const meta = buildMeta(window, total);

    return {
      counts,
      percentages: {
        dragon: pct(counts.DRAGON),
        tiger: pct(counts.TIGER),
        tie: pct(counts.TIE),
      },
      meta,
    };
  }

  async getStreaks(userId: string, window: number) {
    const rounds = await this.prisma.betSelection.findMany({
      where: { userId, status: { not: 'PLACED' } },
      orderBy: { createdAt: 'desc' },
      take: window,
      select: { round: { select: { outcome: true } }, side: true, status: true },
    });

    if (!rounds.length) return { currentStreak: null, longestStreaks: {}, meta: buildMeta(window, 0) };

    // Current streak = consecutive same outcome at front of list
    const outcomes = rounds.map((r) => r.round.outcome as Outcome);
    let currentSide = outcomes[0]!;
    let current = 0;
    for (const o of outcomes) {
      if (o === currentSide) current++;
      else break;
    }

    // Longest per side
    const longest: Record<string, number> = { DRAGON: 0, TIGER: 0, TIE: 0 };
    let run = 1;
    for (let i = 1; i < outcomes.length; i++) {
      if (outcomes[i] === outcomes[i - 1]) {
        run++;
      } else {
        const side = outcomes[i - 1]!;
        if (run > (longest[side] ?? 0)) longest[side] = run;
        run = 1;
      }
    }
    const lastSide = outcomes[outcomes.length - 1]!;
    if (run > (longest[lastSide] ?? 0)) longest[lastSide] = run;

    return {
      currentStreak: { side: currentSide, length: current },
      longestStreaks: longest,
      meta: buildMeta(window, outcomes.length),
    };
  }

  async getCurrentPrediction(userId: string, roomId?: string) {
    const window = 50;
    const summary = await this._computeSummary(userId, window, roomId);
    const { meta, counts } = summary;

    if (meta.confidence === 'insufficient_data') {
      return {
        estimate: null,
        reason: `Insufficient data — need at least 10 rounds, have ${meta.sampleSize}.`,
        meta,
      };
    }

    // Model: predict highest-frequency side. NEVER stronger than 'low' confidence.
    const dominantSide = (Object.entries(counts) as [Outcome, number][]).sort(
      ([, a], [, b]) => b - a,
    )[0]![0];

    return {
      estimate: {
        side: dominantSide,
        label: 'Historical tendency — not a prediction of the next round',
        historicalFrequency: summary.percentages[dominantSide.toLowerCase() as 'dragon' | 'tiger' | 'tie'],
      },
      reason: null,
      meta: { ...meta, confidence: 'low' as const }, // ceiling: never higher than low
    };
  }
}

/**
 * Throws when operator-authored text claims more than the analytics support.
 *
 * Called before persisting model notes, so an admin sees the problem while
 * writing rather than a player seeing it in production.
 */
export function assertNoBannedPhrases(text: string): void {
  const found = findBannedPhrase(text);

  if (found) {
    throw new BadRequestException(
      `This text claims more than the analytics can support: "${found}". ` +
        'Describe what the data shows, not what will happen.',
    );
  }
}

export { BANNED_PREDICTION_PHRASES };
