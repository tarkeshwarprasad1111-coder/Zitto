'use client';

import { forwardRef } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700 border border-brand-600',
  secondary:
    'bg-surface-elevated text-surface-fg border border-surface-border hover:bg-surface-overlay hover:border-surface-muted/50',
  outline:
    'bg-transparent text-surface-subtle border border-surface-border hover:bg-surface-elevated hover:text-surface-fg',
  ghost:
    'bg-transparent text-surface-subtle border border-transparent hover:bg-surface-elevated hover:text-surface-fg',
  danger: 'bg-danger-600 text-white hover:bg-danger-500 active:bg-danger-700 border border-danger-600',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5 rounded',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-sm gap-2 rounded-md',
  icon: 'h-9 w-9 p-0 rounded-md',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks interaction. */
  isLoading?: boolean;
  /** Replaces the label while loading. Falls back to the existing children. */
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    loadingText,
    leftIcon,
    rightIcon,
    fullWidth = false,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  const isDisabled = disabled === true || isLoading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg',
        'disabled:pointer-events-none disabled:opacity-50',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner size={size === 'sm' ? 'xs' : 'sm'} label={null} />
          {size === 'icon' ? null : <span>{loadingText ?? children}</span>}
          <span className="sr-only">Loading</span>
        </>
      ) : (
        <>
          {leftIcon ? (
            <span aria-hidden="true" className="shrink-0">
              {leftIcon}
            </span>
          ) : null}
          {children}
          {rightIcon ? (
            <span aria-hidden="true" className="shrink-0">
              {rightIcon}
            </span>
          ) : null}
        </>
      )}
    </button>
  );
});
