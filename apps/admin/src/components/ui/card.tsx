import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export type CardVariant = 'default' | 'elevated' | 'flat' | 'warning' | 'danger';

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-surface-card border border-surface-border shadow-card',
  elevated: 'bg-surface-elevated border border-surface-border shadow-panel',
  flat: 'bg-surface-card/60 border border-surface-border/70',
  warning: 'bg-warning-500/[0.06] border border-warning-500/30',
  danger: 'bg-danger-500/[0.06] border border-danger-500/30',
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Adds hover affordance for clickable cards. */
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', interactive = false, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg',
        variantStyles[variant],
        interactive &&
          'cursor-pointer transition-colors duration-150 hover:border-brand-600/50 hover:bg-surface-hover',
        className,
      )}
      {...props}
    />
  );
});

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn('flex flex-col gap-1 px-4 py-3.5', className)} {...props} />;
  },
);

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h2' | 'h3' | 'h4';
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle(
  { as: Tag = 'h3', className, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cn('text-sm font-semibold leading-tight text-surface-fg', className)}
      {...props}
    />
  );
});

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p ref={ref} className={cn('text-xs leading-relaxed text-surface-muted', className)} {...props} />
  );
});

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('px-4 pb-4', className)} {...props} />;
  },
);

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-2 border-t border-surface-border px-4 py-3',
          className,
        )}
        {...props}
      />
    );
  },
);
