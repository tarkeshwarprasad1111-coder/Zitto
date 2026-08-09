import { Injectable, Logger } from '@nestjs/common';
import { ActorType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorType: ActorType;
  /** Null for anonymous/system actors. */
  actorId?: string | null;
  /** Dotted verb, e.g. `auth.login`, `wallet.debit`, `game.bet.placed`. */
  action: string;
  targetType: string;
  targetId?: string | null;
  payload?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

/**
 * Append-only audit trail.
 *
 * Two ways in:
 *  - `record()`  — fire-and-forget, never throws, for logging outside a transaction.
 *  - `recordTx()` — participates in a caller's transaction, so a money mutation and
 *    its audit row commit or roll back together.
 *
 * `record()` deliberately swallows failures: an audit write must never be the
 * reason a user's bet or withdrawal fails. Failures are logged at error level so
 * they surface in monitoring.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Best-effort write. Safe to call without awaiting from a hot path. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.recordTx(this.prisma, entry);
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for action="${entry.action}" target="${entry.targetType}:${entry.targetId ?? '-'}"`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Transactional write. Pass the `tx` client from `prisma.$transaction` so the
   * audit row shares the fate of the business mutation.
   */
  async recordTx(client: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    await client.auditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        payloadJson: this.buildPayload(entry),
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }

  private buildPayload(entry: AuditEntry): Prisma.InputJsonValue {
    const base =
      entry.payload && typeof entry.payload === 'object' && !Array.isArray(entry.payload)
        ? { ...(entry.payload as Record<string, unknown>) }
        : { value: entry.payload ?? null };

    if (entry.correlationId) {
      base.correlationId = entry.correlationId;
    }

    return JSON.parse(serializeBigInt(base)) as Prisma.InputJsonValue;
  }
}

/** BigInt is not JSON-serializable; coins are persisted as decimal strings. */
function serializeBigInt(value: unknown): string {
  return JSON.stringify(value, (_key, val) =>
    typeof val === 'bigint' ? val.toString() : val,
  );
}
