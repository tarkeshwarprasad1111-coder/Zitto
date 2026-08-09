'use client';

import { ChevronDown } from 'lucide-react';
import { forwardRef, useId } from 'react';

import {
  FieldLabel,
  FieldMessage,
  controlClassName,
  controlStateClassName,
  type FieldShellProps,
} from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'children'>,
    FieldShellProps {
  options: readonly SelectOption[];
  /** Prepends a non-value option, e.g. "All statuses". */
  placeholder?: string;
  size?: 'sm' | 'md';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    error,
    hint,
    hideLabel = false,
    options,
    placeholder,
    size = 'md',
    id,
    className,
    containerClassName,
    required,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  const describedBy =
    [error ? errorId : null, !error && hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-1.5', containerClassName)}>
      {label ? (
        <FieldLabel htmlFor={selectId} required={required} hidden={hideLabel}>
          {label}
        </FieldLabel>
      ) : null}

      <div className="relative flex items-center">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-errormessage={error ? errorId : undefined}
          className={cn(
            controlClassName,
            controlStateClassName(Boolean(error)),
            'cursor-pointer appearance-none pr-8',
            size === 'sm' ? 'h-8 text-xs' : 'h-9',
            className,
          )}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 text-surface-muted"
        />
      </div>

      <FieldMessage error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  );
});
