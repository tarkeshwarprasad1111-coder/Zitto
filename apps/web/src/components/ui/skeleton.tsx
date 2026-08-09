import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Turn off the shimmer sweep, leaving a plain placeholder block. */
  shimmer?: boolean;
}

export function Skeleton({ shimmer = true, className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-lg bg-surface-elevated',
        shimmer &&
          'after:absolute after:inset-0 after:animate-shimmer after:bg-shimmer after:bg-[length:200%_100%] after:content-[""] motion-reduce:after:animate-none',
        className,
      )}
      {...props}
    />
  );
}

/** Convenience: a few stacked text lines, last one short. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3.5', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-2xl border border-surface-border bg-surface-card p-4', className)}
      role="status"
      aria-label="Loading content"
    >
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-8 w-1/2" />
      <SkeletonText lines={2} />
    </div>
  );
}
