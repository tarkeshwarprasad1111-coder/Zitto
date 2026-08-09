import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-overlay text-surface-subtle border-surface-border',
  success: 'bg-success-500/12 text-success-400 border-success-500/30',
  warning: 'bg-warning-500/12 text-warning-400 border-warning-500/30',
  danger: 'bg-danger-500/12 text-danger-400 border-danger-500/30',
  info: 'bg-brand-500/12 text-brand-300 border-brand-500/30',
  outline: 'bg-transparent text-surface-muted border-surface-border',
};

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-2xs',
  md: 'px-2 py-0.5 text-xs',
} as const;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: keyof typeof sizeStyles;
  /** Small leading dot in the variant colour. */
  dot?: boolean;
  /** Animates the dot — reserve for genuinely live state (a running round). */
  pulse?: boolean;
}

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  pulse = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded border font-medium leading-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-90',
            pulse && 'animate-pulse-dot',
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
