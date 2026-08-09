import { PrismaClient, type Prisma } from '@prisma/client';
import { deriveDraw, signRound, type Outcome } from './fairness.js';
import { DEFAULT_PAYOUTS, settleBet, type PayoutTable } from './payout.js';
import { config } from './config.js';

export interface SettlementSummary {
  roundId: string;
  outcome: Outcome;
  dragonCard: string;
  tigerCard: string;
  betsSettled: number;
  coinsPaidOut: bigint;
}

/**
 * Settles one round inside a single transaction.
 *
 * The engine is the only writer for game_rounds and for the WIN/REFUND
 * ledger rows, so a compromised API instance cannot forge an outcome or
 * a payout. Re-running this for an already-settled round is a no-op,
 * which keeps retries after a crash safe.
 */
export async function settleRound(
  prisma: PrismaClient,
  roundId: string,
  payouts: PayoutTable = DEFAULT_PAYOUTS,
): Promise<SettlementSummary | null> {
  return prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; state: string }>>`
        SELECT id, state FROM game_rounds WHERE id = ${roundId}::uuid FOR UPDATE
      `;
      const row = locked[0];
      if (!row || row.state === 'SETTLED' || row.state === 'VOIDED') {
        return null;
      }

      const round = await tx.gameRound.findUniqueOrThrow({
        where: { id: roundId },
        include: { bets: { where: { status: 'PLACED' } } },
      });

      if (!round.serverSeed) {
        throw new Error(`Round ${roundId} has no server seed to reveal`);
      }

      const draw = deriveDraw(round.serverSeed, round.clientSeed, round.nonce);
      const signature = signRound(
        {
          roundId: round.id,
          serverSeed: round.serverSeed,
          clientSeed: round.clientSeed,
          nonce: round.nonce,
          dragonCard: draw.dragonCard,
          tigerCard: draw.tigerCard,
          outcome: draw.outcome,
        },
        config.fairnessKey,
      );

      let coinsPaidOut = 0n;

      for (const bet of round.bets) {
        const result = settleBet(
          bet.side as Outcome,
          bet.amount,
          draw.outcome,
          payouts,
        );

        await tx.betSelection.update({
          where: { id: bet.id },
          data: {
            status: result.result,
            payout: result.payout,
            settledAt: new Date(),
          },
        });

        if (result.payout > 0n) {
          await creditWinnings(tx, {
            userId: bet.userId,
            amount: result.payout,
            type: result.result === 'WON' ? 'WIN' : 'REFUND',
            roundId: round.id,
            betId: bet.id,
          });
          coinsPaidOut += result.payout;
        }
      }

      await tx.gameRound.update({
        where: { id: round.id },
        data: {
          state: 'SETTLED',
          dragonCard: draw.dragonCard,
          tigerCard: draw.tigerCard,
          outcome: draw.outcome,
          settledAt: new Date(),
          fairnessSignature: signature,
        },
      });

      await tx.gamePrediction.updateMany({
        where: { roundId: round.id, actualSide: null },
        data: { actualSide: draw.outcome },
      });

      return {
        roundId: round.id,
        outcome: draw.outcome,
        dragonCard: draw.dragonCard,
        tigerCard: draw.tigerCard,
        betsSettled: round.bets.length,
        coinsPaidOut,
      };
    },
    { timeout: 20_000, isolationLevel: 'Serializable' },
  );
}

async function creditWinnings(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    amount: bigint;
    type: 'WIN' | 'REFUND';
    roundId: string;
    betId: string;
  },
): Promise<void> {
  const idempotencyKey = `settle:${input.betId}:${input.type}`;

  const existing = await tx.walletLedger.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) return;

  const wallets = await tx.$queryRaw<Array<{ id: string; balance: bigint }>>`
    SELECT id, balance FROM virtual_wallets WHERE user_id = ${input.userId}::uuid FOR UPDATE
  `;
  const wallet = wallets[0];
  if (!wallet) {
    throw new Error(`No wallet for user ${input.userId}`);
  }

  const balanceAfter = wallet.balance + input.amount;

  await tx.walletLedger.create({
    data: {
      walletId: wallet.id,
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      balanceBefore: wallet.balance,
      balanceAfter,
      sourceType: 'round',
      sourceId: input.roundId,
      idempotencyKey,
      actorType: 'GAME_ENGINE',
      metadata: { betId: input.betId },
    },
  });

  await tx.virtualWallet.update({
    where: { id: wallet.id },
    data: { balance: balanceAfter, version: { increment: 1 } },
  });
}
