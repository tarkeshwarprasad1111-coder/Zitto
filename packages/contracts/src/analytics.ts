import { z } from 'zod';
import {
  CONFIDENCE_LABELS,
  INDEPENDENCE_DISCLAIMER,
} from './disclaimers.js';

/**
 * Provenance every analytics payload must carry. Making these required at the
 * schema level means an endpoint physically cannot return a bare number, and a
 * UI component that validates its props cannot render one.
 */
export const provenanceSchema = z.object({
  /** How many rounds went into this figure. */
  sampleSize: z.number().int().nonnegative(),
  /** The rolling window requested, e.g. 50. */
  window: z.number().int().positive(),
  /** Identifier for the calculation, e.g. 'rolling_frequency'. */
  method: z.string().min(1),
  lastUpdated: z.string().datetime(),
  disclaimer: z.literal(INDEPENDENCE_DISCLAIMER),
});

export type Provenance = z.infer<typeof provenanceSchema>;

export const outcomeSchema = z.enum(['DRAGON', 'TIGER', 'TIE']);
export type Outcome = z.infer<typeof outcomeSchema>;

export const confidenceLabelSchema = z.enum(CONFIDENCE_LABELS);

export const analyticsSummarySchema = provenanceSchema.extend({
  dragonCount: z.number().int().nonnegative(),
  tigerCount: z.number().int().nonnegative(),
  tieCount: z.number().int().nonnegative(),
  dragonPct: z.number().min(0).max(100),
  tigerPct: z.number().min(0).max(100),
  tiePct: z.number().min(0).max(100),
  insufficientData: z.boolean(),
});

export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;

export const streakSchema = provenanceSchema.extend({
  currentSide: outcomeSchema.nullable(),
  currentLength: z.number().int().nonnegative(),
  longestDragon: z.number().int().nonnegative(),
  longestTiger: z.number().int().nonnegative(),
  insufficientData: z.boolean(),
});

export type StreakStats = z.infer<typeof streakSchema>;

/**
 * A model estimate. Note there is no field for a guaranteed or predicted
 * result — only an observed tendency with an explicit confidence ceiling.
 */
export const predictionEstimateSchema = provenanceSchema.extend({
  modelCode: z.string().min(1),
  modelVersion: z.string().min(1),
  /** The side history leans toward, or null when there is no signal. */
  observedTendency: outcomeSchema.nullable(),
  confidenceLabel: confidenceLabelSchema,
  /** Published historical accuracy. Never hidden, even when poor. */
  historicalAccuracy: z.number().min(0).max(1).nullable(),
  historicalSampleSize: z.number().int().nonnegative(),
  insufficientData: z.boolean(),
});

export type PredictionEstimate = z.infer<typeof predictionEstimateSchema>;

export const modelStatusSchema = z.object({
  code: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  minDataRounds: z.number().int().positive(),
  accuracy: z.number().min(0).max(1).nullable(),
  sampleSize: z.number().int().nonnegative(),
  brierScore: z.number().nullable(),
  lastUpdated: z.string().datetime().nullable(),
  /** Set when accuracy fell below the configured floor. */
  autoDisabledReason: z.string().nullable(),
});

export type ModelStatus = z.infer<typeof modelStatusSchema>;
