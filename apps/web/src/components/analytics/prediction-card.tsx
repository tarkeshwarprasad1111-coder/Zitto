'use client';

import { Info, Minus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, formatPercent, formatRelativeTime, outcomeLabel, OUTCOME_STYLES } from '@/lib/utils';
import type { ConfidenceLabel, PredictionEstimate } from '@/types';

export interface PredictionCardProps {
  estimate: PredictionEstimate;
  className?: string;
}

const confidenceVariant: Record<ConfidenceLabel, 'default' | 'warning' | 'gold'> = {
  'No reliable signal': 'default',
  'Low confidence': 'warning',
  'Moderate signal': 'gold',
};

const confidenceExplanation: Record<ConfidenceLabel, string> = {
  'No reliable signal':
    'The observed rates are too close together, or the sample is too small, for the model to lean either way.',
  'Low confidence':
    'A small difference is visible in the sample, but it is well within the range you would expect from chance alone.',
  'Moderate signal':
    'A larger-than-usual difference appears in this sample. It still describes past rounds only and carries no predictive guarantee.',
};

/**
 * Displays a model estimate together with everything needed to judge it.
 *
 * This component is the last line of defence against a number being shown as
 * a tip. It refuses to render — throwing rather than degrading — if the
 * confidence label, sample size or independence disclaimer is absent, so an
 * estimate can never reach a player stripped of its caveats.
 */
export function PredictionCard({ estimate, className }: PredictionCardProps) {
  const missing: string[] = [];
  if (!estimate) missing.push('estimate');
  if (!estimate?.confidenceLabel) missing.push('confidenceLabel');
  if (
    estimate?.sampleSize === undefined ||
    estimate?.sampleSize === null ||
    Number.isNaN(estimate?.sampleSize)
  ) {
    missing.push('sampleSize');
  }
  if (!estimate?.disclaimer || estimate.disclaimer.trim() === '') missing.push('disclaimer');

  if (missing.length > 0) {
    throw new Error(
      `PredictionCard refuses to render an incomplete estimate. Missing: ${missing.join(', ')}. ` +
        'A model estimate must always carry its confidence label, sample size and independence disclaimer.',
    );
  }

  const {
    estimatedSide,
    probability,
    confidenceLabel,
    sampleSize,
    window,
    method,
    historicalAccuracy,
    accuracySampleSize,
    disclaimer,
    lastUpdated,
    modelCode,
    modelVersion,
  } = estimate;

  const sideStyles = estimatedSide ? OUTCOME_STYLES[estimatedSide] : null;

  return (
    <Card
      variant="gradient"
      className={cn('flex flex-col gap-4 p-4', className)}
      aria-label="Model estimate"
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-surface-fg">Model estimate</h3>
          <p className="mt-0.5 text-2xs text-surface-muted">
            {modelCode} · v{modelVersion}
          </p>
        </div>
        <Tooltip
          label="How this estimate is produced"
          content={
            <span className="flex flex-col gap-1.5">
              <span className="block font-semibold text-surface-fg">Method</span>
              <span className="block">{method}</span>
              <span className="block pt-1 text-surface-muted">
                This is a statistical observation of rounds that have already been settled. It is
                not a forecast, and it cannot tell you what the next round will be.
              </span>
            </span>
          }
        />
      </header>

      {/* The estimate itself */}
      <div className="flex items-center gap-4">
        {estimatedSide ? (
          <div
            className={cn(
              'flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border',
              sideStyles?.bg,
              sideStyles?.border,
            )}
          >
            <span className={cn('font-display text-sm font-bold', sideStyles?.text)}>
              {outcomeLabel(estimatedSide)}
            </span>
            <span className="text-2xs tabular-nums text-surface-muted">
              {formatPercent(probability, 0)}
            </span>
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-surface-border bg-surface-elevated text-surface-muted">
            <Minus size={22} aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <Badge variant={confidenceVariant[confidenceLabel]} size="sm" dot>
            {confidenceLabel}
          </Badge>
          <p className="mt-1.5 text-xs leading-relaxed text-surface-subtle">
            {estimatedSide
              ? `Across the last ${sampleSize} settled rounds, ${outcomeLabel(estimatedSide)} appeared more often. This is a historical tendency in the sample, not a forecast.`
              : `Across the last ${sampleSize} settled rounds, no side appeared often enough to separate it from normal variation.`}
          </p>
          <p className="mt-1 text-2xs text-surface-muted">{confidenceExplanation[confidenceLabel]}</p>
        </div>
      </div>

      {/* Provenance grid */}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-surface-border bg-surface-bg/40 p-3 text-2xs">
        <div>
          <dt className="text-surface-muted">Rounds analysed</dt>
          <dd className="font-semibold tabular-nums text-surface-subtle">
            {sampleSize.toLocaleString('en-IN')}
          </dd>
        </div>
        <div>
          <dt className="text-surface-muted">Rolling window</dt>
          <dd className="font-semibold tabular-nums text-surface-subtle">{window} rounds</dd>
        </div>
        <div>
          <dt className="text-surface-muted">Model accuracy to date</dt>
          <dd className="font-semibold tabular-nums text-surface-subtle">
            {/* "Not scored yet" is the honest reading. A dash here would look
                like a rendering fault; a number would be an invention. */}
            {historicalAccuracy === null ? (
              <span className="font-normal text-surface-muted">Not scored yet</span>
            ) : (
              formatPercent(historicalAccuracy)
            )}
          </dd>
        </div>
        <div>
          <dt className="text-surface-muted">Accuracy sample</dt>
          <dd className="font-semibold tabular-nums text-surface-subtle">
            {accuracySampleSize.toLocaleString('en-IN')} rounds
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-surface-muted">Last updated</dt>
          <dd className="font-semibold text-surface-subtle">
            <time dateTime={lastUpdated}>{formatRelativeTime(lastUpdated)}</time>
          </dd>
        </div>
      </dl>

      {/* Mandatory independence notice — rendered verbatim, never collapsed. */}
      <p
        role="note"
        className="flex items-start gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3 text-xs font-medium leading-relaxed text-gold-200"
      >
        <Info size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-gold-400" />
        <span>{disclaimer}</span>
      </p>
    </Card>
  );
}
