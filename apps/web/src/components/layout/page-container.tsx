import { cn } from '@/lib/utils';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds bottom padding clearing the fixed bottom nav. */
  withBottomNav?: boolean;
  /** Removes the default horizontal padding, for edge-to-edge sections. */
  flush?: boolean;
  as?: 'div' | 'main' | 'section';
  size?: 'default' | 'wide';
}

/**
 * Consistent page shell: mobile-first max width, safe-area insets, and
 * enough bottom padding that content is never trapped under the nav bar.
 */
export function PageContainer({
  withBottomNav = true,
  flush = false,
  as: Tag = 'main',
  size = 'default',
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <Tag
      className={cn(
        'mx-auto w-full px-safe',
        size === 'wide' ? 'max-w-3xl' : 'max-w-lg',
        !flush && 'px-4',
        // 4.25rem nav + safe area + breathing room
        withBottomNav ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]' : 'pb-8',
        'pt-4',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/** A titled block within a page, with optional trailing action. */
export function PageSection({
  title,
  action,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { title?: string; action?: React.ReactNode }) {
  return (
    <section className={cn('flex flex-col gap-3', className)} {...props}>
      {title || action ? (
        <div className="flex items-baseline justify-between gap-3">
          {title ? (
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-surface-muted">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
