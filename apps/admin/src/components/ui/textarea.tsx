'use client';

import { forwardRef, useId } from 'react';

import {
  FieldLabel,
  FieldMessage,
  controlClassName,
  controlStateClassName,
  type FieldShellProps,
} from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    FieldShellProps {
  /** Show a `used / maxLength` counter under the field. */
  showCount?: boolean;
  /** Render with a monospace face — for markdown, JSON and seeds. */
  mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    error,
    hint,
    hideLabel = false,
    showCount = false,
    mono = false,
    id,
    className,
    containerClassName,
    required,
    rows = 4,
    maxLength,
    value,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;
  const hintId = `${textareaId}-hint`;

  const describedBy =
    [error ? errorId : null, !error && hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  const length = typeof value === 'string' ? value.length : undefined;

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-1.5', containerClassName)}>
      {label ? (
        <FieldLabel htmlFor={textareaId} required={required} hidden={hideLabel}>
          {label}
        </FieldLabel>
      ) : null}

      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        required={required}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-errormessage={error ? errorId : undefined}
        className={cn(
          controlClassName,
          controlStateClassName(Boolean(error)),
          'resize-y py-2 leading-relaxed',
          mono && 'font-mono text-xs',
          className,
        )}
        {...props}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <FieldMessage error={error} hint={hint} errorId={errorId} hintId={hintId} />
        </div>
        {showCount && maxLength ? (
          <span
            className={cn(
              'shrink-0 text-2xs tabular-nums',
              length !== undefined && length > maxLength * 0.9
                ? 'text-warning-400'
                : 'text-surface-muted',
            )}
          >
            {length ?? 0} / {maxLength}
          </span>
        ) : null}
      </div>
    </div>
  );
});
