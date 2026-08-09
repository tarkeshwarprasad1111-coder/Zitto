'use client';

import { forwardRef, useId } from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  /** Validation message. Its presence flips the field into the error state. */
  error?: string;
  /** Helper text shown when there is no error. */
  hint?: string;
  leftIcon?: React.ReactNode;
  /** Rendered on the right — an icon, or an interactive control like a reveal toggle. */
  rightIcon?: React.ReactNode;
  /** Visually hide the label while keeping it available to screen readers. */
  hideLabel?: boolean;
  containerClassName?: string;
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
    <div className={cn('flex w-full flex-col gap-1.5', containerClassName)}>
      {label ? (
        <label
          htmlFor={inputId}
          className={cn(
            'text-sm font-medium text-surface-subtle',
            hideLabel && 'sr-only',
          )}
        >
          {label}
          {required ? (
            <span className="ml-0.5 text-dragon-400" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <div className="relative flex items-center">
        {leftIcon ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 flex text-surface-muted"
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
            'min-h-11 w-full rounded-xl border bg-surface-elevated px-3.5 text-base text-surface-fg',
            'placeholder:text-surface-muted',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-bg',
            'disabled:cursor-not-allowed disabled:opacity-50',
            leftIcon && 'pl-10',
            rightIcon && 'pr-11',
            error
              ? 'border-danger-500/70 focus:border-danger-500 focus:ring-danger-500/60'
              : 'border-surface-border focus:border-gold-500/70 focus:ring-gold-400',
            className,
          )}
          {...props}
        />

        {rightIcon ? (
          <span className="absolute right-2 flex items-center text-surface-muted">{rightIcon}</span>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs leading-snug text-danger-400">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs leading-snug text-surface-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
