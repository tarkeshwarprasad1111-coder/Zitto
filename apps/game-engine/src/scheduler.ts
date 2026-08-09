import { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { randomBytes } from 'node:crypto';
import { generateServerSeed, hashSeed } from './fairness.js';
import { settleRound } from './settlement.js';
import { config } from './config.js';
import type { Logger } from 'pino';

export interface RoundEvent {
  type: 'round:opened' | 'round:drawing' | 'round:settled';
  roomId: string;
  roundId: string;
  payload: Record<string, unknown>;
}

/**
 * Drives the round lifecycle for every open room:
 *   BETTING -> DRAWING -> SETTLED -> (next round opens)
 *
 * Each room is advanced under a short Redis lock so running several
 * engine replicas does not double-open or double-settle a round.
 */
export class RoundScheduler {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly publish: (event: RoundEvent) => Promise<void>,
  ) {}

  private timer?: NodeJS.Timeout;
  private running = false;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, config.tickIntervalMs);
    this.logger.info({ intervalMs: config.tickIntervalMs }, 'scheduler started');
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    // Let an in-flight tick finish so we never abandon an open transaction.
    while (this.running) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.logger.info('scheduler stopped');
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const rooms = await this.prisma.gameRoom.findMany({
        where: { status: 'OPEN' },
        select: { id: true },
      });
      await Promise.all(rooms.map((room) => this.advanceRoom(room.id)));
    } catch (error) {
      this.logger.error({ err: error }, 'scheduler tick failed');
    } finally {
      this.running = false;
    }
  }

  private async advanceRoom(roomId: string): Promise<void> {
    const lockKey = `lock:room:${roomId}`;
    const token = randomBytes(16).toString('hex');
    const acquired = await this.redis.set(
      lockKey,
      token,
      'PX',
      config.lockTtlMs,
      'NX',
    );
    if (!acquired) return;

    try {
      const current = await this.prisma.gameRound.findFirst({
        where: { roomId, state: { in: ['BETTING', 'DRAWING'] } },
        orderBy: { roundNumber: 'desc' },
      });

      if (!current) {
        await this.openRound(roomId);
        return;
      }

      const now = Date.now();

      if (current.state === 'BETTING') {
        const closesAt =
          current.bettingStartedAt.getTime() + config.phases.bettingMs;
        if (now >= closesAt) await this.beginDrawing(current.id, roomId);
        return;
      }

      const settlesAt =
        (current.bettingEndedAt?.getTime() ?? now) + config.phases.drawingMs;
      if (now >= settlesAt) await this.finishRound(current.id, roomId);
    } catch (error) {
      this.logger.error({ err: error, roomId }, 'failed to advance room');
    } finally {
      await this.releaseLock(lockKey, token);
    }
  }

  private async openRound(roomId: string): Promise<void> {
    const previous = await this.prisma.gameRound.findFirst({
      where: { roomId },
      orderBy: { roundNumber: 'desc' },
      select: { roundNumber: true, settledAt: true },
    });

    // Hold the result on screen before the next betting window opens.
    if (previous?.settledAt) {
      const opensAt = previous.settledAt.getTime() + config.phases.resultMs;
      if (Date.now() < opensAt) return;
    }

    const serverSeed = generateServerSeed();
    const round = await this.prisma.gameRound.create({
      data: {
        roomId,
        roundNumber: (previous?.roundNumber ?? 0) + 1,
        state: 'BETTING',
        bettingStartedAt: new Date(),
        serverSeed,
        serverSeedHash: hashSeed(serverSeed),
        clientSeed: randomBytes(16).toString('hex'),
        nonce: (previous?.roundNumber ?? 0) + 1,
      },
    });

    await this.publish({
      type: 'round:opened',
      roomId,
      roundId: round.id,
      payload: {
        roundNumber: round.roundNumber,
        // The seed itself stays hidden until settlement.
        serverSeedHash: round.serverSeedHash,
        clientSeed: round.clientSeed,
        bettingEndsAt: new Date(
          round.bettingStartedAt.getTime() + config.phases.bettingMs,
        ).toISOString(),
      },
    });
  }

  private async beginDrawing(roundId: string, roomId: string): Promise<void> {
    await this.prisma.gameRound.update({
      where: { id: roundId },
      data: { state: 'DRAWING', bettingEndedAt: new Date() },
    });

    await this.publish({
      type: 'round:drawing',
      roomId,
      roundId,
      payload: {
        revealAt: new Date(Date.now() + config.phases.drawingMs).toISOString(),
      },
    });
  }

  private async finishRound(roundId: string, roomId: string): Promise<void> {
    const summary = await settleRound(this.prisma, roundId);
    if (!summary) return;

    this.logger.info(
      {
        roundId,
        outcome: summary.outcome,
        bets: summary.betsSettled,
        paidOut: summary.coinsPaidOut.toString(),
      },
      'round settled',
    );

    await this.publish({
      type: 'round:settled',
      roomId,
      roundId,
      payload: {
        outcome: summary.outcome,
        dragonCard: summary.dragonCard,
        tigerCard: summary.tigerCard,
        betsSettled: summary.betsSettled,
      },
    });
  }

  /** Only clears the lock if we still own it. */
  private async releaseLock(key: string, token: string): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(script, 1, key, token);
  }
}
