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
        'relative overflow-hidden rounded bg-surface-elevated',
        shimmer &&
          'after:absolute after:inset-0 after:animate-shimmer after:bg-shimmer after:bg-[length:200%_100%] after:content-[""] motion-reduce:after:animate-none',
        className,
      )}
      {...props}
    />
  );
}

/** A few stacked text lines, last one short. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('rounded-lg border border-surface-border bg-surface-card p-4', className)}
    >
      <Skeleton className="mb-3 h-3 w-1/3" />
      <Skeleton className="mb-3 h-7 w-1/2" />
      <SkeletonText lines={2} />
    </div>
  );
}

/** Placeholder rows sized to a data table. Used by `DataTable`. */
export function SkeletonRows({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-surface-divider last:border-b-0">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <td key={columnIndex} className="px-3 py-3">
              <Skeleton
                className={cn('h-3.5', columnIndex === 0 ? 'w-32' : columnIndex % 3 === 0 ? 'w-16' : 'w-24')}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
