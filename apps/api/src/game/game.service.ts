import { Injectable, Logger } from '@nestjs/common';
import { ActorType, GameMode, Prisma, RoundState } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

import { AuditService } from '../common/audit/audit.service';
import { buildPage, type Page } from '../common/dto/pagination.dto';
import { PAGINATION, SETTING_KEY } from '../common/constants';
import type { RequestContextData } from '../common/decorators/request-context.decorator';
import {
  ConflictDomainException,
  ForbiddenDomainException,
  NotFoundDomainException,
  UnauthorizedDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type {
  CreateRoomDto,
  GameConfigDto,
  GameHistoryDto,
  JoinRoomDto,
  ListRoomsDto,
  RoomDto,
  RoundDto,
} from './dto/game.dto';
import { normalizeCard } from './fairness.service';

/** Room modes a player is allowed to create. Public and tournament rooms are operated. */
const PLAYER_CREATABLE_MODES: ReadonlySet<GameMode> = new Set([
  GameMode.PRIVATE,
  GameMode.PRACTICE,
]);

/** Presence entries expire if a client vanishes without calling leave. */
const PRESENCE_TTL_SECONDS = 15 * 60;

const VIRTUAL_CURRENCY_NOTICE =
  'Zitto coins are a virtual currency with no cash value. They cannot be purchased, withdrawn, or exchanged for money or goods.';

/**
 * Rooms, rounds, and configuration.
 *
 * ## Presence
 *
 * Room occupancy is tracked in Redis rather than a database table. Presence is
 * ephemeral by nature — a player who closes the tab is gone whether or not they
 * told us — and a durable table would accumulate rows that are wrong the moment a
 * connection drops. Redis sets with a TTL model it honestly: entries lapse if not
 * refreshed, and capacity checks read live occupancy.
 *
 * ## Rounds
 *
 * This service only *reads* rounds. `game_rounds` is append-only and written
 * exclusively by the game engine; the API never creates, mutates or settles one.
 */
@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────────── Configuration ─────────────────────────────

  /**
   * Effective game configuration.
   *
   * `AppSetting` rows win over environment defaults, so operators can retune
   * stakes and timers without a deploy.
   */
  async getConfig(): Promise<GameConfigDto> {
    const [settings, flags] = await Promise.all([
      this.prisma.appSetting.findMany({
        where: { key: { startsWith: 'game.' } },
        select: { key: true, value: true },
      }),
      this.prisma.featureFlag.findMany({ select: { key: true, enabled: true } }),
    ]);

    const setting = new Map(settings.map((row) => [row.key, row.value]));

    const featureFlags: Record<string, boolean> = { ...this.config.featureFlagDefaults };
    for (const flag of flags) {
      featureFlags[flag.key] = flag.enabled;
    }

    const maintenanceRaw = setting.get(SETTING_KEY.GAME_MAINTENANCE);
    const maintenance = parseMaintenance(maintenanceRaw);

    return {
      modes: [GameMode.CLASSIC, GameMode.QUICK, GameMode.PRACTICE, GameMode.PRIVATE],
      minBet: readCoinSetting(setting, SETTING_KEY.GAME_MIN_BET, this.config.economy.minBet),
      maxBet: readCoinSetting(setting, SETTING_KEY.GAME_MAX_BET, this.config.economy.maxBet),
      payouts: {
        DRAGON: readStringSetting(setting, SETTING_KEY.GAME_PAYOUT_DRAGON, '2'),
        TIGER: readStringSetting(setting, SETTING_KEY.GAME_PAYOUT_TIGER, '2'),
        TIE: readStringSetting(setting, SETTING_KEY.GAME_PAYOUT_TIE, '8'),
      },
      timers: {
        bettingMs: readNumberSetting(
          setting,
          SETTING_KEY.GAME_BETTING_MS,
          this.config.roundTimings.bettingMs,
        ),
        drawingMs: readNumberSetting(
          setting,
          SETTING_KEY.GAME_DRAWING_MS,
          this.config.roundTimings.drawingMs,
        ),
        resultMs: readNumberSetting(
          setting,
          SETTING_KEY.GAME_RESULT_MS,
          this.config.roundTimings.resultMs,
        ),
      },
      featureFlags,
      maintenance: maintenance.enabled,
      maintenanceMessage: maintenance.message,
      virtualCurrencyNotice: VIRTUAL_CURRENCY_NOTICE,
    };
  }

  /** Effective stake bounds, honouring room-level overrides within platform limits. */
  async getStakeBounds(roomSettings?: Prisma.JsonValue | null): Promise<{
    min: bigint;
    max: bigint;
  }> {
    const config = await this.getConfig();

    let min = BigInt(config.minBet);
    let max = BigInt(config.maxBet);

    if (roomSettings && typeof roomSettings === 'object' && !Array.isArray(roomSettings)) {
      const record = roomSettings as Record<string, unknown>;
      const roomMin = tryBigInt(record.minBet);
      const roomMax = tryBigInt(record.maxBet);

      // A room may narrow the platform range; it may never widen it.
      if (roomMin !== null && roomMin > min) min = roomMin;
      if (roomMax !== null && roomMax < max) max = roomMax;
    }

    return { min, max };
  }

  // ───────────────────────────── Rooms ─────────────────────────────

  async listRooms(query: ListRoomsDto): Promise<Page<RoomDto>> {
    const where: Prisma.GameRoomWhereInput = { deletedAt: null };

    if (query.mode) {
      where.mode = query.mode;
    } else {
      // Private rooms are reachable by invite code, not by browsing.
      where.mode = { not: GameMode.PRIVATE };
    }

    if (query.status) {
      where.status = query.status;
    }

    const take = Math.min(query.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    const rooms = await this.prisma.gameRoom.findMany({
      where,
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: ROOM_SELECT,
    });

    const page = buildPage(rooms, take);
    const counts = await Promise.all(page.items.map((room) => this.getOccupancy(room.id)));

    return {
      ...page,
      items: page.items.map((room, index) => this.toRoomDto(room, counts[index] ?? 0)),
    };
  }

  /** Creates a player-hosted room. */
  async createRoom(
    userId: string,
    dto: CreateRoomDto,
    ctx: RequestContextData,
  ): Promise<RoomDto & { inviteCode: string | null }> {
    if (!PLAYER_CREATABLE_MODES.has(dto.mode)) {
      throw new ForbiddenDomainException(
        `Players may only create ${[...PLAYER_CREATABLE_MODES].join(' or ')} rooms.`,
        'ROOM_MODE_NOT_ALLOWED',
      );
    }

    const bounds = await this.getStakeBounds();

    const minBet = dto.minBet ? BigInt(dto.minBet) : bounds.min;
    const maxBet = dto.maxBet ? BigInt(dto.maxBet) : bounds.max;

    if (minBet < bounds.min || maxBet > bounds.max) {
      throw new ValidationDomainException(
        `Room stakes must sit inside the platform range of ${bounds.min}–${bounds.max} coins.`,
        'STAKE_BOUNDS_OUT_OF_RANGE',
      );
    }

    if (minBet > maxBet) {
      throw new ValidationDomainException(
        'Minimum stake cannot exceed maximum stake.',
        'STAKE_BOUNDS_INVERTED',
      );
    }

    const passwordHash = dto.password
      ? await argon2.hash(dto.password, {
          type: argon2.argon2id,
          ...this.config.argon2,
        })
      : null;

    const inviteCode = await this.generateUniqueInviteCode();

    const room = await this.prisma.gameRoom.create({
      data: {
        mode: dto.mode,
        hostUserId: userId,
        inviteCode,
        maxPlayers: dto.maxPlayers,
        status: 'OPEN',
        passwordHash,
        settingsJson: {
          name: dto.name ?? null,
          minBet: minBet.toString(),
          maxBet: maxBet.toString(),
          bettingMs: this.config.roundTimings.bettingMs,
        },
      },
      select: ROOM_SELECT,
    });

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: userId,
      action: 'game.room_created',
      targetType: 'game_room',
      targetId: room.id,
      payload: {
        mode: dto.mode,
        maxPlayers: dto.maxPlayers,
        passwordProtected: passwordHash !== null,
        minBet: minBet.toString(),
        maxBet: maxBet.toString(),
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    // The host is in the room by virtue of creating it.
    await this.addPresence(room.id, userId);

    return { ...this.toRoomDto(room, 1), inviteCode: room.inviteCode };
  }

  /**
   * Joins a room, enforcing capacity and any password or invite requirement.
   *
   * Capacity is checked under a short Redis mutex so two simultaneous joins for
   * the last seat cannot both succeed.
   */
  async joinRoom(
    userId: string,
    roomId: string,
    dto: JoinRoomDto,
    ctx: RequestContextData,
  ): Promise<RoomDto> {
    const room = await this.requireRoom(roomId);

    if (room.status !== 'OPEN') {
      throw new ConflictDomainException(
        'This room is not accepting players right now.',
        'ROOM_NOT_OPEN',
      );
    }

    if (room.mode === GameMode.PRIVATE && room.inviteCode) {
      if (!dto.inviteCode || dto.inviteCode.trim().toUpperCase() !== room.inviteCode) {
        throw new ForbiddenDomainException(
          'A valid invite code is required to join this room.',
          'INVITE_CODE_REQUIRED',
        );
      }
    }

    if (room.passwordHash) {
      if (!dto.password) {
        throw new UnauthorizedDomainException(
          'This room is password protected.',
          'ROOM_PASSWORD_REQUIRED',
        );
      }

      const ok = await argon2.verify(room.passwordHash, dto.password).catch(() => false);

      if (!ok) {
        throw new UnauthorizedDomainException(
          'That room password is not correct.',
          'ROOM_PASSWORD_INVALID',
        );
      }
    }

    const occupancy = await this.redis.withLock(
      `lock:room:${roomId}:join`,
      async () => {
        const current = await this.getOccupancy(roomId);
        const alreadyIn = await this.redis.raw.sismember(presenceKey(roomId), userId);

        if (!alreadyIn && current >= room.maxPlayers) {
          throw new ConflictDomainException(
            `This room is full (${room.maxPlayers} players).`,
            'ROOM_FULL',
          );
        }

        await this.addPresence(roomId, userId);
        return alreadyIn ? current : current + 1;
      },
      {
        ttlMs: 5_000,
        onBusy: () =>
          new ConflictDomainException(
            'The room is handling another join right now. Try again.',
            'ROOM_JOIN_BUSY',
          ),
      },
    );

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: userId,
      action: 'game.room_joined',
      targetType: 'game_room',
      targetId: roomId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    return this.toRoomDto(room, occupancy);
  }

  /** Leaves a room. Idempotent — leaving a room you are not in is not an error. */
  async leaveRoom(
    userId: string,
    roomId: string,
    ctx: RequestContextData,
  ): Promise<{ message: string; playerCount: number }> {
    await this.requireRoom(roomId);

    await this.redis.raw.srem(presenceKey(roomId), userId);
    const playerCount = await this.getOccupancy(roomId);

    await this.audit.record({
      actorType: ActorType.USER,
      actorId: userId,
      action: 'game.room_left',
      targetType: 'game_room',
      targetId: roomId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
    });

    return { message: 'Left the room.', playerCount };
  }

  // ───────────────────────────── Rounds ─────────────────────────────

  /** The round currently accepting bets or being drawn, if any. */
  async getCurrentRound(roomId: string): Promise<RoundDto | null> {
    await this.requireRoom(roomId);

    const round = await this.prisma.gameRound.findFirst({
      where: { roomId, state: { in: [RoundState.BETTING, RoundState.DRAWING] } },
      orderBy: { roundNumber: 'desc' },
      select: ROUND_SELECT,
    });

    return round ? this.toRoundDto(round) : null;
  }

  /** A single round. Cards and seed are withheld until the round has settled. */
  async getRound(roundId: string): Promise<RoundDto> {
    const round = await this.prisma.gameRound.findUnique({
      where: { id: roundId },
      select: ROUND_SELECT,
    });

    if (!round) {
      throw new NotFoundDomainException('Round', roundId);
    }

    return this.toRoundDto(round);
  }

  /** The caller's settled-round history, newest first, with their own bets attached. */
  async getHistory(
    userId: string,
    query: GameHistoryDto,
  ): Promise<Page<RoundDto & { bets: Array<{ side: string; amount: string; status: string; payout: string | null }> }>> {
    const take = Math.min(query.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    const where: Prisma.GameRoundWhereInput = {
      // Only rounds this user actually took part in.
      bets: { some: { userId } },
      state: { in: [RoundState.SETTLED, RoundState.VOIDED] },
    };

    if (query.roomId) {
      where.roomId = query.roomId;
    }

    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }

    const rounds = await this.prisma.gameRound.findMany({
      where,
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        ...ROUND_SELECT,
        bets: {
          where: { userId },
          select: { side: true, amount: true, status: true, payout: true },
        },
      },
    });

    const page = buildPage(rounds, take);

    return {
      ...page,
      items: page.items.map((round) => ({
        ...this.toRoundDto(round),
        bets: round.bets.map((bet) => ({
          side: bet.side,
          amount: bet.amount.toString(),
          status: bet.status,
          payout: bet.payout?.toString() ?? null,
        })),
      })),
    };
  }

  // ───────────────────────────── Internals ─────────────────────────────

  /** Loads a room or throws. Shared by every room operation. */
  async requireRoom(roomId: string): Promise<RoomRecord> {
    const room = await this.prisma.gameRoom.findFirst({
      where: { id: roomId, deletedAt: null },
      select: { ...ROOM_SELECT, passwordHash: true, settingsJson: true },
    });

    if (!room) {
      throw new NotFoundDomainException('Room', roomId);
    }

    return room;
  }

  /** Live occupancy from the presence set. */
  async getOccupancy(roomId: string): Promise<number> {
    return this.redis.raw.scard(presenceKey(roomId));
  }

  private async addPresence(roomId: string, userId: string): Promise<void> {
    const key = presenceKey(roomId);
    await this.redis.raw.sadd(key, userId);
    await this.redis.expire(key, PRESENCE_TTL_SECONDS);
  }

  /** Short, unambiguous invite code. Excludes characters that look alike. */
  private async generateUniqueInviteCode(): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const bytes = randomBytes(6);
      const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');

      const clash = await this.prisma.gameRoom.findUnique({
        where: { inviteCode: code },
        select: { id: true },
      });

      if (!clash) {
        return code;
      }
    }

    throw new ConflictDomainException(
      'Could not allocate a unique invite code. Try again.',
      'INVITE_CODE_ALLOCATION_FAILED',
    );
  }

  private toRoomDto(room: RoomListRecord, playerCount: number): RoomDto {
    return {
      id: room.id,
      mode: room.mode,
      inviteCode: room.mode === GameMode.PRIVATE ? null : room.inviteCode,
      maxPlayers: room.maxPlayers,
      playerCount,
      status: room.status,
      passwordProtected: 'passwordHash' in room ? room.passwordHash !== null : false,
      hostUserId: room.hostUserId,
      createdAt: room.createdAt.toISOString(),
    };
  }

  private toRoundDto(round: RoundRecord): RoundDto {
    const settled = round.state === RoundState.SETTLED || round.state === RoundState.VOIDED;
    const drawn = settled || round.state === RoundState.DRAWING;

    const bettingEndsAt = round.bettingEndedAt;
    const remainingMs =
      round.state === RoundState.BETTING && bettingEndsAt
        ? Math.max(0, bettingEndsAt.getTime() - Date.now())
        : null;

    return {
      id: round.id,
      roomId: round.roomId,
      roundNumber: round.roundNumber,
      state: round.state,
      serverSeedHash: round.serverSeedHash,
      // Revealing the seed before settlement would let a player compute the result
      // while betting is still open.
      serverSeed: settled ? round.serverSeed : null,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      dragonCard: drawn ? normalizeCard(round.dragonCard) : null,
      tigerCard: drawn ? normalizeCard(round.tigerCard) : null,
      outcome: settled ? round.outcome : null,
      bettingEndsAt: bettingEndsAt?.toISOString() ?? null,
      remainingMs,
      settledAt: round.settledAt?.toISOString() ?? null,
    };
  }
}

const ROOM_SELECT = {
  id: true,
  mode: true,
  inviteCode: true,
  maxPlayers: true,
  status: true,
  hostUserId: true,
  createdAt: true,
} satisfies Prisma.GameRoomSelect;

const ROUND_SELECT = {
  id: true,
  roomId: true,
  roundNumber: true,
  state: true,
  serverSeed: true,
  serverSeedHash: true,
  clientSeed: true,
  nonce: true,
  dragonCard: true,
  tigerCard: true,
  outcome: true,
  bettingEndedAt: true,
  settledAt: true,
} satisfies Prisma.GameRoundSelect;

type RoomListRecord = Prisma.GameRoomGetPayload<{ select: typeof ROOM_SELECT }> & {
  passwordHash?: string | null;
};

export type RoomRecord = Prisma.GameRoomGetPayload<{
  select: typeof ROOM_SELECT & { passwordHash: true; settingsJson: true };
}>;

type RoundRecord = Prisma.GameRoundGetPayload<{ select: typeof ROUND_SELECT }>;

function presenceKey(roomId: string): string {
  return `room:${roomId}:players`;
}

function readCoinSetting(
  settings: Map<string, string>,
  key: string,
  fallback: bigint,
): string {
  const raw = settings.get(key);
  return raw && /^\d+$/.test(raw) ? raw : fallback.toString();
}

function readNumberSetting(
  settings: Map<string, string>,
  key: string,
  fallback: number,
): number {
  const raw = settings.get(key);
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readStringSetting(
  settings: Map<string, string>,
  key: string,
  fallback: string,
): string {
  return settings.get(key) ?? fallback;
}

function parseMaintenance(raw: string | undefined): { enabled: boolean; message: string | null } {
  if (!raw) {
    return { enabled: false, message: null };
  }

  try {
    const parsed = JSON.parse(raw) as { enabled?: boolean; message?: string };
    return { enabled: parsed.enabled === true, message: parsed.message ?? null };
  } catch {
    return { enabled: raw === 'true', message: null };
  }
}

function tryBigInt(value: unknown): bigint | null {
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return BigInt(value);
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  return null;
}
