import { ApiProperty } from '@nestjs/swagger';
import { GameMode, Outcome, RoomStatus, RoundState } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PAGINATION } from '../../common/constants';

/** Coin amount arriving from a client: decimal string, positive integer. */
const coinAmountSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const text = typeof value === 'number' ? String(value) : value.trim();

    if (!/^\d+$/.test(text)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Coin amounts must be positive whole numbers, sent as a decimal string.',
      });
      return z.NEVER;
    }

    return BigInt(text);
  })
  .refine((value) => value > 0n, { message: 'Amount must be greater than zero.' });

export const listRoomsSchema = z.object({
  mode: z.nativeEnum(GameMode).optional(),
  status: z.nativeEnum(RoomStatus).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
});

export class ListRoomsDto extends createZodDto(listRoomsSchema) {}

export const createRoomSchema = z.object({
  name: z.string().trim().min(3).max(48).optional(),
  mode: z
    .nativeEnum(GameMode)
    .default(GameMode.PRIVATE)
    .describe('Only PRIVATE and PRACTICE rooms may be created by players.'),
  maxPlayers: z.coerce.number().int().min(2).max(50).default(8),
  /** Optional room password. Stored only as an Argon2id hash. */
  password: z.string().min(4).max(64).optional(),
  minBet: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe('Room-level minimum stake. Cannot go below the platform minimum.'),
  maxBet: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe('Room-level maximum stake. Cannot exceed the platform maximum.'),
});

export class CreateRoomDto extends createZodDto(createRoomSchema) {}

export const joinRoomSchema = z.object({
  inviteCode: z.string().trim().min(4).max(16).optional(),
  password: z.string().min(4).max(64).optional(),
});

export class JoinRoomDto extends createZodDto(joinRoomSchema) {}

export const placeBetSchema = z.object({
  side: z.nativeEnum(Outcome).describe('DRAGON, TIGER or TIE.'),
  amount: coinAmountSchema,
  /**
   * Client-generated. Retrying with the same key returns the original bet instead
   * of staking twice — the difference between a flaky network and a double loss.
   */
  idempotencyKey: z
    .string()
    .trim()
    .min(8, 'Provide an idempotency key of at least 8 characters.')
    .max(128),
});

export class PlaceBetDto extends createZodDto(placeBetSchema) {}

export const gameHistorySchema = z.object({
  roomId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
});

export class GameHistoryDto extends createZodDto(gameHistorySchema) {}

// ───────────────────────── Response shapes ─────────────────────────

export class GameConfigDto {
  @ApiProperty({ enum: GameMode, isArray: true })
  modes!: GameMode[];

  @ApiProperty({ example: '10', description: 'Platform minimum stake, in coins.' })
  minBet!: string;

  @ApiProperty({ example: '10000', description: 'Platform maximum stake, in coins.' })
  maxBet!: string;

  @ApiProperty({
    description: 'Payout multipliers by side. Returned as strings to avoid float drift.',
    example: { DRAGON: '2', TIGER: '2', TIE: '8' },
  })
  payouts!: Record<string, string>;

  @ApiProperty({ example: { bettingMs: 20000, drawingMs: 6000, resultMs: 4000 } })
  timers!: { bettingMs: number; drawingMs: number; resultMs: number };

  @ApiProperty({ example: { real_money: false, live_dealer: false, spin_wheel: false } })
  featureFlags!: Record<string, boolean>;

  @ApiProperty({ description: 'True when play is temporarily disabled.' })
  maintenance!: boolean;

  @ApiProperty({ nullable: true })
  maintenanceMessage!: string | null;

  @ApiProperty({
    description: 'Coins have no cash value and cannot be withdrawn or exchanged.',
  })
  virtualCurrencyNotice!: string;
}

export class RoomDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: GameMode })
  mode!: GameMode;

  @ApiProperty({ nullable: true })
  inviteCode!: string | null;

  @ApiProperty()
  maxPlayers!: number;

  @ApiProperty({ description: 'Current occupancy, tracked as live presence.' })
  playerCount!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty({ description: 'True when the room requires a password to join.' })
  passwordProtected!: boolean;

  @ApiProperty({ nullable: true, format: 'uuid' })
  hostUserId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class RoundDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  roomId!: string;

  @ApiProperty()
  roundNumber!: number;

  @ApiProperty({ enum: RoundState })
  state!: RoundState;

  @ApiProperty({
    description: 'Commitment published before betting opens. Verify it after settlement.',
  })
  serverSeedHash!: string;

  @ApiProperty({ nullable: true, description: 'Revealed only after settlement.' })
  serverSeed!: string | null;

  @ApiProperty({ nullable: true })
  clientSeed!: string | null;

  @ApiProperty()
  nonce!: number;

  @ApiProperty({ nullable: true, description: 'Withheld until the cards are drawn.' })
  dragonCard!: string | null;

  @ApiProperty({ nullable: true })
  tigerCard!: string | null;

  @ApiProperty({ enum: Outcome, nullable: true })
  outcome!: Outcome | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  bettingEndsAt!: string | null;

  @ApiProperty({ nullable: true, description: 'Milliseconds left in the betting window.' })
  remainingMs!: number | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  settledAt!: string | null;
}

export class BetDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  roundId!: string;

  @ApiProperty({ enum: Outcome })
  side!: Outcome;

  @ApiProperty({ example: '100' })
  amount!: string;

  @ApiProperty({ example: 'PLACED' })
  status!: string;

  @ApiProperty({ nullable: true, example: null })
  payout!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class PlaceBetResultDto {
  @ApiProperty({ type: BetDto })
  bet!: BetDto;

  @ApiProperty({
    description: 'Wallet state immediately after the stake was debited.',
    example: { balance: '1400', available: '1400' },
  })
  wallet!: { balance: string; available: string };

  @ApiProperty({
    description: 'True when this call matched an existing bet and staked nothing further.',
  })
  replayed!: boolean;
}
