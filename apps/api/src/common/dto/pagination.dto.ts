import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PAGINATION } from '../constants';

/**
 * Cursor pagination contract shared by every list endpoint.
 *
 * Cursors are opaque to clients — currently the id of the last row seen, ordered
 * by `(createdAt DESC, id DESC)`. Offset pagination is deliberately unsupported:
 * ledgers and round history grow without bound and offsets drift under writes.
 */
export const paginationSchema = z.object({
  cursor: z
    .string()
    .uuid('cursor must be an opaque record id')
    .optional()
    .describe('Id of the last item from the previous page.'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_LIMIT)
    .default(PAGINATION.DEFAULT_LIMIT)
    .describe(`Items per page (max ${PAGINATION.MAX_LIMIT}).`),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export class PaginationDto extends createZodDto(paginationSchema) {}

/** Envelope returned by every cursor-paginated endpoint. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

/**
 * Builds a page from an over-fetched result set.
 * Callers should query `limit + 1` rows so `hasMore` is exact rather than guessed.
 */
export function buildPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.length > 0 ? items[items.length - 1] : undefined;

  return {
    items,
    nextCursor: hasMore && last ? last.id : null,
    hasMore,
    limit,
  };
}
