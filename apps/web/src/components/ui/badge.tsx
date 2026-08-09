import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'dragon'
  | 'tiger'
  | 'gold'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-elevated text-surface-subtle border-surface-border',
  dragon: 'bg-dragon-500/15 text-dragon-300 border-dragon-500/35',
  tiger: 'bg-tiger-500/15 text-tiger-300 border-tiger-500/35',
  gold: 'bg-gold-500/15 text-gold-300 border-gold-500/35',
  success: 'bg-success-500/15 text-success-400 border-success-500/35',
  warning: 'bg-warning-500/15 text-warning-400 border-warning-500/35',
  danger: 'bg-danger-500/15 text-danger-400 border-danger-500/35',
  outline: 'bg-transparent text-surface-muted border-surface-border',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-2xs',
  md: 'px-2.5 py-1 text-xs',
} as const;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: keyof typeof sizeStyles;
  /** Small leading dot in the variant colour. */
  dot?: boolean;
}

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium leading-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      ) : null}
      {children}
    </span>
  );
}
