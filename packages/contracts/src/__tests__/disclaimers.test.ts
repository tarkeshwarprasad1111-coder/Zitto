import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_LABELS,
  confidenceForSample,
  containsProhibitedLanguage,
} from '../disclaimers.js';
import { predictionEstimateSchema } from '../analytics.js';
import { INDEPENDENCE_DISCLAIMER } from '../disclaimers.js';

describe('confidenceForSample', () => {
  it('reports no signal below the minimum sample', () => {
    expect(confidenceForSample(0)).toBe('No reliable signal');
    expect(confidenceForSample(29)).toBe('No reliable signal');
  });

  it('reports low confidence in the middle band', () => {
    expect(confidenceForSample(30)).toBe('Low confidence');
    expect(confidenceForSample(99)).toBe('Low confidence');
  });

  it('caps at moderate signal no matter how large the sample', () => {
    expect(confidenceForSample(100)).toBe('Moderate signal');
    expect(confidenceForSample(1_000_000)).toBe('Moderate signal');
  });

  it('offers no tier above moderate', () => {
    expect(CONFIDENCE_LABELS).toHaveLength(3);
    expect(CONFIDENCE_LABELS).not.toContain('High confidence');
  });
});

describe('containsProhibitedLanguage', () => {
  it('catches banned claims regardless of case', () => {
    expect(containsProhibitedLanguage('GUARANTEED WIN today')).toBe(
      'guaranteed win',
    );
    expect(containsProhibitedLanguage('this is a Sure Shot')).toBe('sure shot');
    expect(containsProhibitedLanguage('Double Your Money')).toBe(
      'double your money',
    );
  });

  it('passes acceptable analytics phrasing', () => {
    expect(containsProhibitedLanguage('Historical tendency: Dragon')).toBeNull();
    expect(containsProhibitedLanguage('Low confidence')).toBeNull();
    expect(containsProhibitedLanguage('No reliable signal')).toBeNull();
    expect(containsProhibitedLanguage(INDEPENDENCE_DISCLAIMER)).toBeNull();
  });
});

describe('predictionEstimateSchema', () => {
  const valid = {
    sampleSize: 120,
    window: 50,
    method: 'rolling_frequency',
    lastUpdated: new Date().toISOString(),
    disclaimer: INDEPENDENCE_DISCLAIMER,
    modelCode: 'freq_rolling_50',
    modelVersion: '1.0.0',
    observedTendency: 'DRAGON' as const,
    confidenceLabel: 'Moderate signal' as const,
    historicalAccuracy: 0.34,
    historicalSampleSize: 5000,
    insufficientData: false,
  };

  it('accepts a fully provenanced estimate', () => {
    expect(predictionEstimateSchema.parse(valid)).toEqual(valid);
  });

  it('rejects an estimate with no sample size', () => {
    const { sampleSize: _omitted, ...rest } = valid;
    expect(() => predictionEstimateSchema.parse(rest)).toThrow();
  });

  it('rejects an estimate with no disclaimer', () => {
    const { disclaimer: _omitted, ...rest } = valid;
    expect(() => predictionEstimateSchema.parse(rest)).toThrow();
  });

  it('rejects a reworded disclaimer', () => {
    expect(() =>
      predictionEstimateSchema.parse({
        ...valid,
        disclaimer: 'Past results may indicate future outcomes.',
      }),
    ).toThrow();
  });

  it('rejects a confidence label outside the allowed set', () => {
    expect(() =>
      predictionEstimateSchema.parse({
        ...valid,
        confidenceLabel: 'High confidence',
      }),
    ).toThrow();
  });

  it('rejects a hidden accuracy figure', () => {
    expect(() =>
      predictionEstimateSchema.parse({ ...valid, historicalAccuracy: 1.5 }),
    ).toThrow();
  });
});
