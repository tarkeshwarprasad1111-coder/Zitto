import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** Usually a lucide icon element. Rendered decoratively. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    variant?: ButtonProps['variant'];
  };
  /** Tighter padding, for use inside a table body. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2.5 text-center',
        compact
          ? 'px-4 py-10'
          : 'rounded-lg border border-dashed border-surface-border bg-surface-card/40 px-6 py-14',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated text-surface-muted"
        >
          {icon}
        </span>
      ) : null}

      <div className="max-w-sm">
        <h3 className="text-sm font-semibold text-surface-fg">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-surface-muted">{description}</p>
        ) : null}
      </div>

      {action ? (
        action.href ? (
          <a href={action.href} className="mt-1">
            <Button variant={action.variant ?? 'secondary'} size="sm">
              {action.label}
            </Button>
          </a>
        ) : (
          <Button
            variant={action.variant ?? 'secondary'}
            size="sm"
            onClick={action.onClick}
            className="mt-1"
          >
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}
