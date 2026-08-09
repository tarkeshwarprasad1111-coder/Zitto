'use client';

import { forwardRef, useId } from 'react';

import { cn } from '@/lib/utils';

/** Shared field chrome: label, hint, error. Reused by textarea and select. */
export interface FieldShellProps {
  label?: string;
  /** Validation message. Its presence flips the field into the error state. */
  error?: string;
  /** Helper text shown when there is no error. */
  hint?: string;
  /** Visually hide the label while keeping it available to screen readers. */
  hideLabel?: boolean;
  required?: boolean;
  containerClassName?: string;
}

export function FieldLabel({
  htmlFor,
  children,
  required,
  hidden,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
  hidden?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('text-xs font-medium text-surface-subtle', hidden && 'sr-only')}
    >
      {children}
      {required ? (
        <span className="ml-0.5 text-danger-400" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export function FieldMessage({
  error,
  hint,
  errorId,
  hintId,
}: {
  error?: string;
  hint?: string;
  errorId: string;
  hintId: string;
}) {
  if (error) {
    return (
      <p id={errorId} role="alert" className="text-xs leading-snug text-danger-400">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={hintId} className="text-xs leading-snug text-surface-muted">
        {hint}
      </p>
    );
  }
  return null;
}

/** Base control styling shared across input, textarea and select. */
export const controlClassName =
  'w-full rounded-md border bg-surface-elevated px-3 text-sm text-surface-fg placeholder:text-surface-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-bg disabled:cursor-not-allowed disabled:opacity-50 read-only:text-surface-subtle';

export function controlStateClassName(hasError: boolean): string {
  return hasError
    ? 'border-danger-500/70 focus:border-danger-500 focus:ring-danger-500/60'
    : 'border-surface-border focus:border-brand-500 focus:ring-brand-500/60';
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    FieldShellProps {
  leftIcon?: React.ReactNode;
  /** Rendered on the right — an icon, or an interactive control. */
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    hideLabel = false,
    id,
    className,
    containerClassName,
    required,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const describedBy =
    [error ? errorId : null, !error && hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-1.5', containerClassName)}>
      {label ? (
        <FieldLabel htmlFor={inputId} required={required} hidden={hideLabel}>
          {label}
        </FieldLabel>
      ) : null}

      <div className="relative flex items-center">
        {leftIcon ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 flex text-surface-muted"
          >
            {leftIcon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-errormessage={error ? errorId : undefined}
          className={cn(
            controlClassName,
            controlStateClassName(Boolean(error)),
            'h-9',
            leftIcon && 'pl-8',
            rightIcon && 'pr-9',
            className,
          )}
          {...props}
        />

        {rightIcon ? (
          <span className="absolute right-1.5 flex items-center text-surface-muted">
            {rightIcon}
          </span>
        ) : null}
      </div>

      <FieldMessage error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  );
});
