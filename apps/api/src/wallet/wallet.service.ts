import { Injectable, Logger } from '@nestjs/common';
import { ActorType, LedgerType, Prisma } from '@prisma/client';

import { AuditService } from '../common/audit/audit.service';
import { LEDGER_SOURCE, PAGINATION, TABLE } from '../common/constants';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { buildPage, type Page } from '../common/dto/pagination.dto';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  InsufficientBalanceException,
  InvalidAmountException,
  WalletNotFoundException,
} from './exceptions/insufficient-balance.exception';

/** Everything needed to move coins. */
export interface WalletMutationParams {
  userId: string;
  /** Always positive. Direction comes from calling `credit()` or `debit()`. */
  amount: bigint;
  type: LedgerType;
  /** What caused this movement, e.g. `round`, `promo_code`. */
  sourceType: string;
  /** Id of the causing record, when there is one. */
  sourceId?: string | null;
  /**
   * Globally unique. Replaying the same key returns the original ledger entry
   * instead of moving coins twice. Required — there is no unsafe path.
   */
  idempotencyKey: string;
  actorType: ActorType;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WalletMutationResult {
  ledgerId: string;
  balanceBefore: bigint;
  balanceAfter: bigint;
  /** Signed: positive for credits, negative for debits. */
  amount: bigint;
  type: LedgerType;
  /** True when this call matched an existing idempotency key and moved nothing. */
  replayed: boolean;
  createdAt: Date;
}

export interface WalletSnapshot {
  walletId: string;
  userId: string;
  balance: bigint;
  locked: bigint;
  bonus: bigint;
  /** `balance - locked` — what may actually be staked right now. */
  available: bigint;
  updatedAt: Date;
}

export interface LedgerFilters {
  type?: LedgerType | LedgerType[];
  from?: Date;
  to?: Date;
  sourceType?: string;
}

export interface ReconciliationReport {
  userId: string;
  walletId: string;
  cachedBalance: bigint;
  ledgerSum: bigint;
  drift: bigint;
  entryCount: number;
  consistent: boolean;
  checkedAt: Date;
}

/** Row shape returned by the locking read. */
interface LockedWalletRow {
  id: string;
  balance: bigint;
  locked: bigint;
  bonus: bigint;
}

/**
 * The single authority over coin balances.
 *
 * ## Invariants
 *
 * 1. **`VirtualWallet.balance` is never written outside this service.** It is a
 *    cache of `SUM(wallet_ledger.amount)`; the ledger is the source of truth.
 * 2. **Every movement is a ledger row.** Append-only, never updated or deleted.
 * 3. **Every movement is idempotent.** The caller supplies a key; the unique index
 *    on `wallet_ledger.idempotency_key` is what actually enforces it, so even a
 *    race between two identical requests can only produce one row.
 * 4. **Every movement holds a row lock.** `SELECT ... FOR UPDATE` on the wallet row
 *    serializes concurrent mutations for the same user, so `balanceBefore` and
 *    `balanceAfter` are always a true, gap-free chain.
 * 5. **Amounts are `bigint`.** No floats touch money, anywhere.
 * 6. **Balances cannot go negative.** A debit that would is refused.
 *
 * ## Composing with other writes
 *
 * Pass an existing `Prisma.TransactionClient` as `tx` to enlist in a caller's
 * transaction — this is how `BetService` makes "debit the stake" and "record the
 * bet" atomic. Without `tx`, a transaction is opened for the single movement.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────────── Core movements ─────────────────────────────

  /** Adds coins. See class docs for guarantees. */
  async credit(
    params: WalletMutationParams,
    tx?: Prisma.TransactionClient,
  ): Promise<WalletMutationResult> {
    return this.mutate(params, 'credit', tx);
  }

  /**
   * Removes coins.
   * @throws {InsufficientBalanceException} if the resulting balance would be negative.
   */
  async debit(
    params: WalletMutationParams,
    tx?: Prisma.TransactionClient,
  ): Promise<WalletMutationResult> {
    return this.mutate(params, 'debit', tx);
  }

  private async mutate(
    params: WalletMutationParams,
    direction: 'credit' | 'debit',
    tx?: Prisma.TransactionClient,
  ): Promise<WalletMutationResult> {
    if (params.amount <= 0n) {
      throw new InvalidAmountException(params.amount);
    }

    if (!params.idempotencyKey || params.idempotencyKey.trim().length < 8) {
      throw new ValidationDomainException(
        'A wallet movement requires an idempotency key of at least 8 characters.',
        'IDEMPOTENCY_KEY_REQUIRED',
      );
    }

    const run = (client: Prisma.TransactionClient) =>
      this.applyMovement(client, params, direction);

    if (tx) {
      return run(tx);
    }

    return this.prisma.$transaction(run, {
      // FOR UPDATE already serializes same-wallet writers; Read Committed keeps
      // unrelated wallets fully concurrent without serialization retries.
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 15_000,
    });
  }

  /** The whole money path, in one place, inside one transaction. */
  private async applyMovement(
    client: Prisma.TransactionClient,
    params: WalletMutationParams,
    direction: 'credit' | 'debit',
  ): Promise<WalletMutationResult> {
    // 1. Replay check. Cheap, and short-circuits before we take any lock.
    const existing = await this.findByIdempotencyKey(client, params.idempotencyKey);

    if (existing) {
      this.assertReplayMatches(existing, params, direction);
      return { ...existing, replayed: true };
    }

    // 2. Take the row lock. Everything after this is serialized per wallet.
    const wallet = await this.lockWallet(client, params.userId);

    const balanceBefore = wallet.balance;
    const signedAmount = direction === 'credit' ? params.amount : -params.amount;
    const balanceAfter = balanceBefore + signedAmount;

    // 3. Solvency.
    if (balanceAfter < 0n) {
      throw new InsufficientBalanceException({
        required: params.amount,
        available: balanceBefore,
      });
    }

    // 4. Append the ledger row. This is the authoritative record.
    let ledger: { id: string; createdAt: Date };

    try {
      ledger = await client.walletLedger.create({
        data: {
          walletId: wallet.id,
          userId: params.userId,
          type: params.type,
          amount: signedAmount,
          balanceBefore,
          balanceAfter,
          sourceType: params.sourceType,
          sourceId: params.sourceId ?? null,
          idempotencyKey: params.idempotencyKey,
          actorType: params.actorType,
          actorId: params.actorId ?? null,
          metadata: toJsonValue(params.metadata),
        },
        select: { id: true, createdAt: true },
      });
    } catch (error) {
      // Lost a race on the unique index: another transaction committed the same
      // key. That transaction's row is the truth; return it.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.findByIdempotencyKey(client, params.idempotencyKey);
        if (winner) {
          this.assertReplayMatches(winner, params, direction);
          return { ...winner, replayed: true };
        }
      }
      throw error;
    }

    // 5. Refresh the cached balance. Guarded on the value we read under the lock,
    //    so a lost update is impossible even if the lock were somehow bypassed.
    const updated = await client.virtualWallet.updateMany({
      where: { id: wallet.id, balance: balanceBefore },
      data: { balance: balanceAfter },
    });

    if (updated.count !== 1) {
      // Unreachable while the lock is held. If it ever fires, the transaction
      // rolls back and the ledger row goes with it.
      throw new ConflictDomainException(
        'Wallet balance changed during the transaction. The operation was rolled back; retry.',
        'WALLET_WRITE_CONFLICT',
      );
    }

    // 6. Audit inside the same transaction — money and its trail commit together.
    await this.audit.recordTx(client, {
      actorType: params.actorType,
      actorId: params.actorId ?? params.userId,
      action: `wallet.${direction}`,
      targetType: 'wallet',
      targetId: wallet.id,
      payload: {
        userId: params.userId,
        ledgerId: ledger.id,
        ledgerType: params.type,
        amount: signedAmount.toString(),
        balanceBefore: balanceBefore.toString(),
        balanceAfter: balanceAfter.toString(),
        sourceType: params.sourceType,
        sourceId: params.sourceId ?? null,
        idempotencyKey: params.idempotencyKey,
      },
    });

    return {
      ledgerId: ledger.id,
      balanceBefore,
      balanceAfter,
      amount: signedAmount,
      type: params.type,
      replayed: false,
      createdAt: ledger.createdAt,
    };
  }

  /**
   * Locks the wallet row for the remainder of the transaction.
   *
   * Raw SQL because Prisma has no `FOR UPDATE` in its query API. Parameterized —
   * the user id is never interpolated into the string.
   */
  private async lockWallet(
    client: Prisma.TransactionClient,
    userId: string,
  ): Promise<LockedWalletRow> {
    const rows = await client.$queryRaw<LockedWalletRow[]>`
      SELECT id, balance, locked, bonus
      FROM ${Prisma.raw(`"${TABLE.VIRTUAL_WALLETS}"`)}
      WHERE user_id = ${userId}::uuid
      FOR UPDATE
    `;

    const wallet = rows[0];

    if (!wallet) {
      throw new WalletNotFoundException(userId);
    }

    // int8 arrives as bigint from Prisma, but be explicit rather than trusting it.
    return {
      id: wallet.id,
      balance: BigInt(wallet.balance),
      locked: BigInt(wallet.locked),
      bonus: BigInt(wallet.bonus),
    };
  }

  private async findByIdempotencyKey(
    client: Prisma.TransactionClient,
    idempotencyKey: string,
  ): Promise<Omit<WalletMutationResult, 'replayed'> | null> {
    const entry = await client.walletLedger.findUnique({
      where: { idempotencyKey },
      select: {
        id: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        type: true,
        userId: true,
        createdAt: true,
      },
    });

    if (!entry) {
      return null;
    }

    return {
      ledgerId: entry.id,
      balanceBefore: entry.balanceBefore,
      balanceAfter: entry.balanceAfter,
      amount: entry.amount,
      type: entry.type,
      createdAt: entry.createdAt,
    };
  }

  /**
   * A key that was used for a *different* movement is a client bug, not a replay.
   * Returning the unrelated entry would silently mis-report the outcome.
   */
  private assertReplayMatches(
    existing: Omit<WalletMutationResult, 'replayed'>,
    params: WalletMutationParams,
    direction: 'credit' | 'debit',
  ): void {
    const expected = direction === 'credit' ? params.amount : -params.amount;

    if (existing.amount !== expected || existing.type !== params.type) {
      throw new ConflictDomainException(
        'This idempotency key was already used for a different wallet movement.',
        'IDEMPOTENCY_KEY_REUSE',
      );
    }
  }

  // ───────────────────────────── Reads ─────────────────────────────

  /** Current balances. Reads the cached value; it is reconciled against the ledger. */
  async getBalance(userId: string): Promise<WalletSnapshot> {
    const wallet = await this.prisma.virtualWallet.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        balance: true,
        locked: true,
        bonus: true,
        updatedAt: true,
      },
    });

    if (!wallet) {
      throw new WalletNotFoundException(userId);
    }

    return {
      walletId: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance,
      locked: wallet.locked,
      bonus: wallet.bonus,
      available: wallet.balance - wallet.locked,
      updatedAt: wallet.updatedAt,
    };
  }

  /** Cursor-paginated ledger history, newest first. */
  async getLedger(
    userId: string,
    cursor?: string,
    limit: number = PAGINATION.DEFAULT_LIMIT,
    filters: LedgerFilters = {},
  ): Promise<Page<LedgerEntryView>> {
    const take = Math.min(Math.max(limit, 1), PAGINATION.MAX_LIMIT);

    const where: Prisma.WalletLedgerWhereInput = { userId };

    if (filters.type) {
      where.type = Array.isArray(filters.type) ? { in: filters.type } : filters.type;
    }

    if (filters.sourceType) {
      where.sourceType = filters.sourceType;
    }

    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    const rows = await this.prisma.walletLedger.findMany({
      where,
      // Over-fetch by one so `hasMore` is exact.
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        type: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        sourceType: true,
        sourceId: true,
        createdAt: true,
      },
    });

    return buildPage(rows, take);
  }

  // ───────────────────────────── Rewards ─────────────────────────────

  /**
   * Grants the once-per-day reward.
   *
   * Idempotency is structural: the key embeds the calendar day in the *user's own
   * timezone*, so the unique index refuses a second grant no matter how many
   * concurrent requests arrive. A replay returns the original grant rather than
   * an error, so a double-tap in the UI is harmless.
   */
  async claimDailyReward(userId: string): Promise<{
    claimed: boolean;
    amount: bigint;
    balance: bigint;
    day: string;
    ledgerId: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    if (!user) {
      throw new NotFoundDomainException('User', userId);
    }

    const day = calendarDay(new Date(), user.timezone ?? 'UTC');
    const amount = this.config.economy.dailyReward;

    const result = await this.credit({
      userId,
      amount,
      type: LedgerType.DAILY_REWARD,
      sourceType: LEDGER_SOURCE.DAILY_REWARD,
      sourceId: null,
      idempotencyKey: `daily-reward:${userId}:${day}`,
      actorType: ActorType.SYSTEM,
      actorId: null,
      metadata: { day, timezone: user.timezone ?? 'UTC' },
    });

    return {
      claimed: !result.replayed,
      amount,
      balance: result.balanceAfter,
      day,
      ledgerId: result.ledgerId,
    };
  }

  /**
   * Redeems a promo code.
   *
   * Eligibility (enabled, in-window, under global and per-user caps) is evaluated
   * against committed ledger rows, then the credit itself is keyed on
   * `promo:{code}:{user}:{n}` so a retry cannot grant twice.
   */
  async redeemPromo(
    userId: string,
    code: string,
  ): Promise<{ amount: bigint; balance: bigint; code: string; ledgerId: string }> {
    const normalized = code.trim().toUpperCase();

    const promo = await this.prisma.promoCode.findUnique({
      where: { code: normalized },
      select: {
        id: true,
        code: true,
        rewardAmount: true,
        maxRedemptions: true,
        perUserLimit: true,
        startsAt: true,
        expiresAt: true,
        enabled: true,
      },
    });

    if (!promo || !promo.enabled) {
      // Same message for "no such code" and "disabled" — do not let the endpoint
      // be used to enumerate valid codes.
      throw new NotFoundDomainException('Promo code', normalized);
    }

    const now = new Date();

    if (promo.startsAt && promo.startsAt.getTime() > now.getTime()) {
      throw new ValidationDomainException(
        'This promo code is not active yet.',
        'PROMO_NOT_STARTED',
      );
    }

    if (promo.expiresAt && promo.expiresAt.getTime() <= now.getTime()) {
      throw new ValidationDomainException('This promo code has expired.', 'PROMO_EXPIRED');
    }

    const [totalRedemptions, userRedemptions] = await Promise.all([
      this.prisma.walletLedger.count({
        where: { sourceType: LEDGER_SOURCE.PROMO_CODE, sourceId: promo.id },
      }),
      this.prisma.walletLedger.count({
        where: { sourceType: LEDGER_SOURCE.PROMO_CODE, sourceId: promo.id, userId },
      }),
    ]);

    if (promo.maxRedemptions !== null && totalRedemptions >= promo.maxRedemptions) {
      throw new ValidationDomainException(
        'This promo code has reached its redemption limit.',
        'PROMO_EXHAUSTED',
      );
    }

    const perUserLimit = promo.perUserLimit ?? 1;

    if (userRedemptions >= perUserLimit) {
      throw new ValidationDomainException(
        perUserLimit === 1
          ? 'You have already redeemed this promo code.'
          : `You have reached the ${perUserLimit}-redemption limit for this code.`,
        'PROMO_ALREADY_REDEEMED',
      );
    }

    const result = await this.credit({
      userId,
      amount: promo.rewardAmount,
      type: LedgerType.PROMO,
      sourceType: LEDGER_SOURCE.PROMO_CODE,
      sourceId: promo.id,
      // Sequence number makes multi-redemption codes safe too.
      idempotencyKey: `promo:${promo.id}:${userId}:${userRedemptions}`,
      actorType: ActorType.USER,
      actorId: userId,
      metadata: { code: promo.code, redemptionIndex: userRedemptions },
    });

    if (result.replayed) {
      throw new ValidationDomainException(
        'You have already redeemed this promo code.',
        'PROMO_ALREADY_REDEEMED',
      );
    }

    return {
      amount: promo.rewardAmount,
      balance: result.balanceAfter,
      code: promo.code,
      ledgerId: result.ledgerId,
    };
  }

  // ───────────────────────────── Integrity ─────────────────────────────

  /**
   * Compares the cached balance against the sum of the ledger.
   *
   * Any non-zero drift means something wrote `balance` outside this service, or a
   * ledger row was mutated — both are serious. This is read-only by design: it
   * reports, it never "fixes". A correction must be a deliberate `CORRECTION`
   * ledger entry with a human behind it.
   */
  async reconcile(userId: string): Promise<ReconciliationReport> {
    const wallet = await this.prisma.virtualWallet.findUnique({
      where: { userId },
      select: { id: true, balance: true },
    });

    if (!wallet) {
      throw new WalletNotFoundException(userId);
    }

    const [aggregate] = await this.prisma.$queryRaw<
      Array<{ total: bigint | null; entries: bigint }>
    >`
      SELECT COALESCE(SUM(amount), 0)::bigint AS total, COUNT(*)::bigint AS entries
      FROM ${Prisma.raw(`"${TABLE.WALLET_LEDGER}"`)}
      WHERE user_id = ${userId}::uuid
    `;

    const ledgerSum = BigInt(aggregate?.total ?? 0n);
    const entryCount = Number(aggregate?.entries ?? 0n);
    const drift = wallet.balance - ledgerSum;

    if (drift !== 0n) {
      this.logger.error(
        `Wallet drift detected for user ${userId}: cached=${wallet.balance} ledger=${ledgerSum} drift=${drift}`,
      );
    }

    return {
      userId,
      walletId: wallet.id,
      cachedBalance: wallet.balance,
      ledgerSum,
      drift,
      entryCount,
      consistent: drift === 0n,
      checkedAt: new Date(),
    };
  }
}

export interface LedgerEntryView {
  id: string;
  type: LedgerType;
  amount: bigint;
  balanceBefore: bigint;
  balanceAfter: bigint;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
}

/** `YYYY-MM-DD` in the given IANA timezone. Falls back to UTC on a bad zone. */
export function calendarDay(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

function toJsonValue(value: Record<string, unknown> | undefined): Prisma.InputJsonValue {
  if (!value) {
    return {};
  }
  return JSON.parse(
    JSON.stringify(value, (_key, val) => (typeof val === 'bigint' ? val.toString() : val)),
  ) as Prisma.InputJsonValue;
}
