'use client';

import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  /** An {@link ApiError}, a plain `Error`, or nothing. */
  error?: unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
  className?: string;
}

function describe(error: unknown): { title: string; description: string; offline: boolean } {
  if (error instanceof ApiError) {
    if (error.isOffline) {
      return {
        title: 'You are offline',
        description: 'Check your connection and try again.',
        offline: true,
      };
    }
    return {
      title: error.problem.title || 'Something went wrong',
      description: error.problem.detail,
      offline: false,
    };
  }

  if (error instanceof Error) {
    return {
      title: 'Something went wrong',
      description: error.message,
      offline: false,
    };
  }

  return {
    title: 'Something went wrong',
    description: 'We could not load this right now. Please try again.',
    offline: false,
  };
}

export function ErrorState({
  error,
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
  isRetrying = false,
  className,
}: ErrorStateProps) {
  const derived = describe(error);
  const correlationId = error instanceof ApiError ? error.correlationId : undefined;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-danger-500/25 bg-danger-500/[0.06] px-6 py-8 text-center',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-500/15 text-danger-400"
      >
        {derived.offline ? <WifiOff size={22} /> : <AlertTriangle size={22} />}
      </span>

      <div className="max-w-xs">
        <h3 className="font-display text-base font-semibold text-surface-fg">
          {title ?? derived.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-surface-muted">
          {description ?? derived.description}
        </p>
      </div>

      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          isLoading={isRetrying}
          loadingText="Retrying"
          leftIcon={<RefreshCw size={15} />}
          className="mt-1"
        >
          {retryLabel}
        </Button>
      ) : null}

      {correlationId ? (
        <p className="mt-1 font-mono text-2xs text-surface-muted">Reference: {correlationId}</p>
      ) : null}
    </div>
  );
}
