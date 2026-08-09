import { ApiProperty } from '@nestjs/swagger';
import { LedgerType } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PAGINATION } from '../../common/constants';

/** Query contract for `GET /wallet/ledger`. */
export const ledgerQuerySchema = z.object({
  cursor: z.string().uuid().optional().describe('Id of the last entry from the previous page.'),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
  type: z
    .union([
      z.nativeEnum(LedgerType),
      z.array(z.nativeEnum(LedgerType)),
      z
        .string()
        .transform((value) => value.split(','))
        .pipe(z.array(z.nativeEnum(LedgerType))),
    ])
    .optional()
    .describe('Filter by movement type. Repeat the param or pass a comma-separated list.'),
  sourceType: z.string().trim().max(64).optional(),
  from: z.coerce.date().optional().describe('Inclusive lower bound on createdAt (ISO 8601).'),
  to: z.coerce.date().optional().describe('Inclusive upper bound on createdAt (ISO 8601).'),
});

export class LedgerQueryDto extends createZodDto(ledgerQuerySchema) {}

export const redeemPromoSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, 'Promo codes are at least 4 characters.')
    .max(32)
    .regex(/^[A-Z0-9_-]+$/, 'Promo codes contain only letters, digits, hyphens and underscores.'),
});

export class RedeemPromoDto extends createZodDto(redeemPromoSchema) {}

// ───────────────────────── Response shapes ─────────────────────────

export class WalletBalanceDto {
  @ApiProperty({ format: 'uuid' })
  walletId!: string;

  @ApiProperty({ description: 'Total coins held. Decimal string.', example: '1500' })
  balance!: string;

  @ApiProperty({ description: 'Coins reserved by in-flight actions.', example: '0' })
  locked!: string;

  @ApiProperty({ description: 'Portion of the balance that came from bonuses.', example: '500' })
  bonus!: string;

  @ApiProperty({ description: 'balance − locked. What can be staked now.', example: '1500' })
  available!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class LedgerEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: LedgerType })
  type!: LedgerType;

  @ApiProperty({
    description: 'Signed coin delta. Positive credits, negative debits. Decimal string.',
    example: '-100',
  })
  amount!: string;

  @ApiProperty({ example: '1500' })
  balanceBefore!: string;

  @ApiProperty({ example: '1400' })
  balanceAfter!: string;

  @ApiProperty({ nullable: true, example: 'round' })
  sourceType!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  sourceId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class LedgerPageDto {
  @ApiProperty({ type: [LedgerEntryDto] })
  items!: LedgerEntryDto[];

  @ApiProperty({ nullable: true, description: 'Pass as `cursor` to fetch the next page.' })
  nextCursor!: string | null;

  @ApiProperty()
  hasMore!: boolean;

  @ApiProperty()
  limit!: number;
}

export class DailyRewardResultDto {
  @ApiProperty({ description: 'False when the reward was already claimed today.' })
  claimed!: boolean;

  @ApiProperty({ example: '100' })
  amount!: string;

  @ApiProperty({ example: '1600' })
  balance!: string;

  @ApiProperty({ description: 'Calendar day in the account timezone.', example: '2026-08-09' })
  day!: string;
}

export class PromoRedemptionResultDto {
  @ApiProperty({ example: 'WELCOME100' })
  code!: string;

  @ApiProperty({ example: '100' })
  amount!: string;

  @ApiProperty({ example: '1700' })
  balance!: string;
}
