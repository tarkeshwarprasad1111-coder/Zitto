import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Alternate row backgrounds. On by default — dense tables need the guide. */
  zebra?: boolean;
  /** Keep the header visible while the body scrolls vertically. */
  stickyHeader?: boolean;
  /** Freeze the first column so identity stays visible during a sideways scroll. */
  pinFirstColumn?: boolean;
  /** Caps the body height and scrolls inside. Pairs with `stickyHeader`. */
  maxHeight?: string;
  /** Applied to the scroll wrapper rather than the `<table>`. */
  containerClassName?: string;
}

/**
 * Data table.
 *
 * The scroll wrapper is what keeps the console from ever scrolling sideways:
 * wide tables overflow inside `.table-scroll`, not on `<body>`.
 */
export const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  {
    zebra = true,
    stickyHeader = true,
    pinFirstColumn = false,
    maxHeight,
    className,
    containerClassName,
    ...props
  },
  ref,
) {
  return (
    <div
      className={cn('table-scroll', maxHeight && 'overflow-y-auto', containerClassName)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table
        ref={ref}
        className={cn(
          'w-full border-collapse text-left text-sm',
          zebra && 'table-zebra',
          stickyHeader && 'table-sticky-head',
          pinFirstColumn && 'table-pin-first',
          className,
        )}
        {...props}
      />
    </div>
  );
});

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableHeader({ className, ...props }, ref) {
  return (
    <thead
      ref={ref}
      className={cn('border-b border-surface-border text-surface-muted', className)}
      {...props}
    />
  );
});

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn('divide-y divide-surface-divider', className)} {...props} />;
});

export const TableFooter = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn('border-t border-surface-border bg-surface-elevated font-medium', className)}
      {...props}
    />
  );
});

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Adds hover + pointer affordance and makes the row keyboard-activatable. */
  clickable?: boolean;
  selected?: boolean;
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(function TableRow(
  { clickable = false, selected = false, className, onClick, onKeyDown, ...props },
  ref,
) {
  return (
    <tr
      ref={ref}
      onClick={onClick}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!clickable || event.defaultPrevented) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          (event.currentTarget as HTMLElement).click();
        }
      }}
      tabIndex={clickable ? 0 : undefined}
      role={clickable ? 'button' : undefined}
      aria-selected={selected || undefined}
      className={cn(
        'transition-colors',
        clickable &&
          'cursor-pointer hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-500',
        selected && 'bg-brand-600/10',
        className,
      )}
      {...props}
    />
  );
});

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
  /** Prevents wrapping — use for short labels above numeric columns. */
  nowrap?: boolean;
}

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(function TableHead(
  { align = 'left', nowrap = true, className, ...props },
  ref,
) {
  return (
    <th
      ref={ref}
      scope="col"
      className={cn(
        'px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        nowrap && 'whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
});

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
  /** Right-aligns and applies tabular figures so digits line up. */
  numeric?: boolean;
  nowrap?: boolean;
}

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(function TableCell(
  { align, numeric = false, nowrap = false, className, ...props },
  ref,
) {
  const resolvedAlign = align ?? (numeric ? 'right' : 'left');

  return (
    <td
      ref={ref}
      className={cn(
        'px-3 py-2.5 align-middle text-surface-subtle',
        resolvedAlign === 'right' && 'text-right',
        resolvedAlign === 'center' && 'text-center',
        numeric && 'tabular-nums',
        nowrap && 'whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
});

/** Caption rendered above the table, e.g. a row count. */
export const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(function TableCaption({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      className={cn('px-3 py-2 text-left text-xs text-surface-muted', className)}
      {...props}
    />
  );
});
