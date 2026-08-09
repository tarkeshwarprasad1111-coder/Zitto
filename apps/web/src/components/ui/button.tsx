'use client';

import { forwardRef } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'dragon'
  | 'tiger'
  | 'tie'
  | 'ghost'
  | 'outline'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-gold text-surface-bg font-semibold shadow-[0_2px_12px_-2px_rgba(245,158,11,0.5)] hover:brightness-110 active:brightness-95',
  dragon:
    'bg-gradient-dragon text-white font-semibold shadow-[0_2px_12px_-2px_rgba(220,38,38,0.5)] hover:brightness-110 active:brightness-95',
  tiger:
    'bg-gradient-tiger text-white font-semibold shadow-[0_2px_12px_-2px_rgba(37,99,235,0.5)] hover:brightness-110 active:brightness-95',
  tie: 'bg-gold-500 text-surface-bg font-semibold hover:bg-gold-400 active:bg-gold-600',
  ghost: 'bg-transparent text-surface-subtle hover:bg-surface-elevated hover:text-surface-fg',
  outline:
    'border border-surface-border bg-surface-card/60 text-surface-fg hover:border-gold-500/60 hover:bg-surface-elevated',
  danger: 'bg-danger-600 text-white font-semibold hover:bg-danger-500 active:bg-danger-600',
};

const sizeStyles: Record<ButtonSize, string> = {
  // Every size clears the 44x44px touch target minimum.
  sm: 'min-h-11 px-3.5 text-sm gap-1.5 rounded-lg',
  md: 'min-h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'min-h-[3.25rem] px-6 text-base gap-2.5 rounded-2xl',
  icon: 'h-11 w-11 p-0 rounded-xl',
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
  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cn(
        'relative inline-flex items-center justify-center whitespace-nowrap',
        'transition-[filter,background-color,border-color,transform] duration-150 ease-spring',
        'active:scale-[0.98] motion-reduce:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg',
        'disabled:pointer-events-none disabled:opacity-45 disabled:saturate-50',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner size={size === 'lg' ? 'md' : 'sm'} label={null} />
          <span>{loadingText ?? children}</span>
          <span className="sr-only">Loading</span>
        </>
      ) : (
        <>
          {leftIcon ? <span aria-hidden="true" className="shrink-0">{leftIcon}</span> : null}
          {children}
          {rightIcon ? <span aria-hidden="true" className="shrink-0">{rightIcon}</span> : null}
        </>
      )}
    </button>
  );
});
