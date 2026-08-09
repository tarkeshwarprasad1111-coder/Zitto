'use client';

import { ChevronLeft, ChevronRight, Inbox, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { EmptyState, type EmptyStateProps } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonRows } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn, formatNumber } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Column config                                                       */
/* ------------------------------------------------------------------ */

export interface DataTableColumn<T> {
  /** Stable key. Also used as the React key for the cell. */
  id: string;
  header: React.ReactNode;
  /** Renders the cell body for a row. */
  cell: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Right-aligns and applies tabular figures. */
  numeric?: boolean;
  nowrap?: boolean;
  /** Fixed or minimum width, e.g. `'12rem'`. */
  width?: string;
  /**
   * Drop the column below this breakpoint. Secondary columns should collapse
   * on narrow viewports rather than forcing a long sideways scroll.
   */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  headClassName?: string;
  cellClassName?: string;
}

const HIDE_BELOW_CLASS = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
} as const;

/* ------------------------------------------------------------------ */
/* Cursor pagination                                                   */
/* ------------------------------------------------------------------ */

export interface CursorPaginationState {
  /** Cursor for the page currently displayed. `null` on the first page. */
  cursor: string | null;
  pageIndex: number;
  pageSize: number;
  canGoBack: boolean;
  next: (nextCursor: string | null) => void;
  back: () => void;
  reset: () => void;
  setPageSize: (size: number) => void;
}

/**
 * Cursor pagination driver.
 *
 * Opaque cursors are forward-only, so going back means remembering the cursor
 * that produced each page. This keeps that stack rather than making every page
 * re-implement it.
 */
export function useCursorPagination(initialPageSize = 25): CursorPaginationState {
  const [stack, setStack] = useState<Array<string | null>>([null]);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const cursor = stack[stack.length - 1] ?? null;

  const next = useCallback((nextCursor: string | null) => {
    if (!nextCursor) return;
    setStack((current) => [...current, nextCursor]);
  }, []);

  const back = useCallback(() => {
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  const reset = useCallback(() => setStack([null]), []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    // Cursors are tied to the page size they were issued for.
    setStack([null]);
  }, []);

  return useMemo(
    () => ({
      cursor,
      pageIndex: stack.length - 1,
      pageSize,
      canGoBack: stack.length > 1,
      next,
      back,
      reset,
      setPageSize,
    }),
    [cursor, stack.length, pageSize, next, back, reset, setPageSize],
  );
}

export interface DataTablePagination {
  hasMore: boolean;
  nextCursor: string | null;
  canGoBack: boolean;
  pageIndex: number;
  pageSize: number;
  /** Server-side total when available. `null` renders a range instead. */
  totalCount?: number | null;
  onNext: (nextCursor: string | null) => void;
  onBack: () => void;
  onPageSizeChange?: (size: number) => void;
}

const PAGE_SIZES = [25, 50, 100] as const;

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  data: readonly T[] | undefined;
  getRowId: (row: T, index: number) => string;
  /** First load. Renders skeleton rows sized to the column count. */
  isLoading?: boolean;
  /** Background refetch. Renders a subtle indicator without blanking the rows. */
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  /** Highlights the active row, e.g. the record open in a side panel. */
  selectedRowId?: string | null;
  emptyState?: Partial<EmptyStateProps>;
  pagination?: DataTablePagination;
  /** Rendered above the table — filters, search, export. */
  toolbar?: React.ReactNode;
  /** Short note under the table, e.g. an immutability disclosure. */
  footnote?: React.ReactNode;
  stickyHeader?: boolean;
  pinFirstColumn?: boolean;
  zebra?: boolean;
  maxHeight?: string;
  /** Accessible name for the table. */
  label: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading = false,
  isFetching = false,
  error,
  onRetry,
  onRowClick,
  selectedRowId = null,
  emptyState,
  pagination,
  toolbar,
  footnote,
  stickyHeader = true,
  pinFirstColumn = false,
  zebra = true,
  maxHeight,
  label,
  className,
}: DataTableProps<T>) {
  const rows = data ?? [];
  const columnCount = columns.length;

  const showSkeleton = isLoading;
  const showError = !isLoading && Boolean(error);
  const showEmpty = !isLoading && !error && rows.length === 0;

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      {toolbar ? <div className="flex min-w-0 flex-col gap-3">{toolbar}</div> : null}

      <div className="relative min-w-0">
        {isFetching && !isLoading ? (
          <div className="pointer-events-none absolute right-3 top-2.5 z-20 flex items-center gap-1.5 rounded bg-surface-overlay/90 px-2 py-1 text-2xs text-surface-muted">
            <Spinner size="xs" label={null} />
            Updating
          </div>
        ) : null}

        <Table
          zebra={zebra}
          stickyHeader={stickyHeader}
          pinFirstColumn={pinFirstColumn}
          {...(maxHeight ? { maxHeight } : {})}
          aria-label={label}
          aria-busy={isLoading || undefined}
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  {...(column.align ? { align: column.align } : column.numeric ? { align: 'right' as const } : {})}
                  nowrap={column.nowrap ?? true}
                  style={column.width ? { width: column.width, minWidth: column.width } : undefined}
                  className={cn(
                    column.hideBelow && HIDE_BELOW_CLASS[column.hideBelow],
                    column.headClassName,
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {showSkeleton ? <SkeletonRows rows={8} columns={columnCount} /> : null}

            {showError ? (
              <tr>
                <td colSpan={columnCount} className="p-0">
                  <ErrorState error={error} {...(onRetry ? { onRetry } : {})} compact />
                </td>
              </tr>
            ) : null}

            {showEmpty ? (
              <tr>
                <td colSpan={columnCount} className="p-0">
                  <EmptyState
                    compact
                    icon={emptyState?.icon ?? <Inbox size={18} />}
                    title={emptyState?.title ?? 'Nothing here yet'}
                    description={
                      emptyState?.description ?? 'No records match the current filters.'
                    }
                    {...(emptyState?.action ? { action: emptyState.action } : {})}
                  />
                </td>
              </tr>
            ) : null}

            {!showSkeleton && !showError
              ? rows.map((row, index) => {
                  const id = getRowId(row, index);
                  return (
                    <TableRow
                      key={id}
                      clickable={Boolean(onRowClick)}
                      selected={selectedRowId === id}
                      {...(onRowClick ? { onClick: () => onRowClick(row) } : {})}
                    >
                      {columns.map((column) => (
                        <TableCell
                          key={column.id}
                          {...(column.align ? { align: column.align } : {})}
                          numeric={column.numeric ?? false}
                          nowrap={column.nowrap ?? false}
                          className={cn(
                            column.hideBelow && HIDE_BELOW_CLASS[column.hideBelow],
                            column.cellClassName,
                          )}
                        >
                          {column.cell(row, index)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              : null}
          </TableBody>
        </Table>
      </div>

      {footnote ? (
        <p className="text-2xs leading-relaxed text-surface-muted">{footnote}</p>
      ) : null}

      {pagination ? (
        <PaginationBar
          pagination={pagination}
          rowCount={rows.length}
          disabled={isLoading || showError}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination bar                                                      */
/* ------------------------------------------------------------------ */

function PaginationBar({
  pagination,
  rowCount,
  disabled,
}: {
  pagination: DataTablePagination;
  rowCount: number;
  disabled: boolean;
}) {
  const { hasMore, nextCursor, canGoBack, pageIndex, pageSize, totalCount, onNext, onBack } =
    pagination;

  const from = pageIndex * pageSize + (rowCount > 0 ? 1 : 0);
  const to = pageIndex * pageSize + rowCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <p className="text-xs tabular-nums text-surface-muted">
          {rowCount === 0
            ? 'No rows'
            : totalCount !== null && totalCount !== undefined
              ? `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(totalCount)}`
              : `Rows ${formatNumber(from)}–${formatNumber(to)}`}
        </p>

        {pagination.onPageSizeChange ? (
          <label className="flex items-center gap-1.5 text-xs text-surface-muted">
            <span className="sr-only sm:not-sr-only">Per page</span>
            <select
              value={pageSize}
              onChange={(event) => pagination.onPageSizeChange?.(Number(event.target.value))}
              disabled={disabled}
              className="h-7 cursor-pointer rounded border border-surface-border bg-surface-elevated px-1.5 text-xs text-surface-subtle focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onBack}
          disabled={!canGoBack || disabled}
          leftIcon={<ChevronLeft size={13} />}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onNext(nextCursor)}
          disabled={!hasMore || !nextCursor || disabled}
          rightIcon={<ChevronRight size={13} />}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar helpers                                                     */
/* ------------------------------------------------------------------ */

/** Row of filter controls above a table. Wraps on narrow viewports. */
export function TableToolbar({
  children,
  actions,
  className,
}: {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-surface-border bg-surface-card p-3 lg:flex-row lg:items-end lg:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2.5">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Refresh button matched to the toolbar's control height. */
export function RefreshButton({
  onClick,
  isFetching,
}: {
  onClick: () => void;
  isFetching?: boolean;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      disabled={isFetching}
      leftIcon={<RefreshCw size={13} className={cn(isFetching && 'animate-spin')} />}
    >
      Refresh
    </Button>
  );
}
