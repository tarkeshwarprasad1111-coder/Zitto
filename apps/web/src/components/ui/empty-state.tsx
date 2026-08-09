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
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-surface-border bg-surface-card/40 px-6 py-10 text-center',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-elevated text-surface-muted"
        >
          {icon}
        </span>
      ) : null}

      <div className="max-w-xs">
        <h3 className="font-display text-base font-semibold text-surface-fg">{title}</h3>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-surface-muted">{description}</p>
        ) : null}
      </div>

      {action ? (
        action.href ? (
          <a href={action.href} className="mt-1">
            <Button variant={action.variant ?? 'outline'} size="sm">
              {action.label}
            </Button>
          </a>
        ) : (
          <Button
            variant={action.variant ?? 'outline'}
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
