import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export type CardVariant = 'default' | 'glass' | 'elevated' | 'gradient' | 'flat';

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-surface-card border border-surface-border shadow-card',
  // Glassmorphism is reserved for hero and summary surfaces — used everywhere
  // it costs contrast and GPU time for no benefit.
  glass: 'glass shadow-elevated',
  elevated: 'bg-surface-elevated border border-surface-border shadow-elevated',
  gradient: 'gradient-border shadow-card',
  flat: 'bg-surface-card/50 border border-surface-border/60',
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Adds hover lift + pointer affordance for clickable cards. */
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
        'rounded-2xl',
        variantStyles[variant],
        interactive &&
          'cursor-pointer transition-[transform,border-color,box-shadow] duration-200 ease-spring hover:-translate-y-0.5 hover:border-gold-500/40 hover:shadow-elevated active:translate-y-0 motion-reduce:hover:translate-y-0',
        className,
      )}
      {...props}
    />
  );
});

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn('flex flex-col gap-1 p-4 sm:p-5', className)} {...props} />;
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
      className={cn('font-display text-base font-semibold leading-tight text-surface-fg', className)}
      {...props}
    />
  );
});

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p ref={ref} className={cn('text-sm leading-relaxed text-surface-muted', className)} {...props} />
  );
});

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('p-4 pt-0 sm:p-5 sm:pt-0', className)} {...props} />;
  },
);

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-3 border-t border-surface-border/70 p-4 sm:p-5',
          className,
        )}
        {...props}
      />
    );
  },
);
