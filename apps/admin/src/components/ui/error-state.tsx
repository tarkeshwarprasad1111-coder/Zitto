'use client';

import { AlertTriangle, RefreshCw, ShieldOff, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AdminApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  /** An {@link AdminApiError}, a plain `Error`, or nothing. */
  error?: unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
  /** Tighter padding, for use inside a table body. */
  compact?: boolean;
  className?: string;
}

type Kind = 'offline' | 'forbidden' | 'generic';

function describe(error: unknown): { title: string; description: string; kind: Kind } {
  if (error instanceof AdminApiError) {
    if (error.isOffline) {
      return {
        title: 'Cannot reach the API',
        description: 'Check your connection, then retry.',
        kind: 'offline',
      };
    }
    if (error.isForbidden) {
      return {
        title: 'Permission denied',
        description:
          error.problem.detail || 'Your role does not cover this data. Ask a super admin for access.',
        kind: 'forbidden',
      };
    }
    return {
      title: error.problem.title || 'Something went wrong',
      description: error.problem.detail,
      kind: 'generic',
    };
  }

  if (error instanceof Error) {
    return { title: 'Something went wrong', description: error.message, kind: 'generic' };
  }

  return {
    title: 'Something went wrong',
    description: 'We could not load this right now. Please try again.',
    kind: 'generic',
  };
}

const ICONS: Record<Kind, React.ReactNode> = {
  offline: <WifiOff size={20} />,
  forbidden: <ShieldOff size={20} />,
  generic: <AlertTriangle size={20} />,
};

export function ErrorState({
  error,
  title,
  description,
  onRetry,
  retryLabel = 'Retry',
  isRetrying = false,
  compact = false,
  className,
}: ErrorStateProps) {
  const derived = describe(error);
  const correlationId = error instanceof AdminApiError ? error.correlationId : undefined;
  // A permission failure will not resolve by retrying — hide the button.
  const canRetry = Boolean(onRetry) && derived.kind !== 'forbidden';

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2.5 text-center',
        compact
          ? 'px-4 py-10'
          : 'rounded-lg border border-danger-500/25 bg-danger-500/[0.05] px-6 py-12',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-500/12 text-danger-400"
      >
        {ICONS[derived.kind]}
      </span>

      <div className="max-w-sm">
        <h3 className="text-sm font-semibold text-surface-fg">{title ?? derived.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-surface-muted">
          {description ?? derived.description}
        </p>
      </div>

      {canRetry ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          isLoading={isRetrying}
          loadingText="Retrying"
          leftIcon={<RefreshCw size={13} />}
          className="mt-1"
        >
          {retryLabel}
        </Button>
      ) : null}

      {correlationId ? (
        <p className="mono-id mt-1">Reference: {correlationId}</p>
      ) : null}
    </div>
  );
}
