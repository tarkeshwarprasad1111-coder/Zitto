import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { ActorType, LedgerType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { LEDGER_SOURCE, SETTING_KEY } from '../common/constants';

/** Default daily reward when the operator has not seeded `wallet.daily_reward`. */
const DEFAULT_DAILY_REWARD = 100n;

/**
 * `AppSetting.value` is `Json`, so a coin amount may arrive as a number, a
 * decimal string, or something an operator mistyped. Anything that is not a
 * whole non-negative number falls back rather than throwing mid-claim.
 */
function coinSetting(value: Prisma.JsonValue | undefined, fallback: bigint): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  return fallback;
}

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async claimDailyReward(userId: string, idempotencyKey: string) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Check already claimed today
    const existing = await this.prisma.walletLedger.findFirst({
      where: {
        userId,
        sourceType: LEDGER_SOURCE.DAILY_REWARD,
        createdAt: { gte: new Date(today) },
      },
    });
    if (existing) throw new ConflictException('Daily reward already claimed today.');

    const setting = await this.prisma.appSetting.findUnique({
      where: { key: SETTING_KEY.DAILY_REWARD },
    });
    const amount = coinSetting(setting?.value, DEFAULT_DAILY_REWARD);

    return this.wallet.credit({
      userId,
      amount,
      type: LedgerType.DAILY_REWARD,
      sourceType: LEDGER_SOURCE.DAILY_REWARD,
      sourceId: null,
      idempotencyKey,
      actorType: ActorType.SYSTEM,
      actorId: null,
    });
  }

  async redeemPromo(userId: string, code: string, idempotencyKey: string) {
    return this.prisma.$transaction(async (tx) => {
      const promo = await tx.promoCode.findUnique({ where: { code } });
      if (!promo || !promo.enabled) throw new NotFoundException('Promo code not found.');

      const now = new Date();
      if (promo.startsAt && promo.startsAt > now) throw new ConflictException('Promo not yet active.');
      if (promo.expiresAt && promo.expiresAt < now) throw new ConflictException('Promo has expired.');

      const redemptions = await tx.promoRedemption.count({ where: { promoCodeId: promo.id } });
      if (promo.maxRedemptions && redemptions >= promo.maxRedemptions)
        throw new ConflictException('Promo code exhausted.');

      const userRedemptions = await tx.promoRedemption.count({
        where: { promoCodeId: promo.id, userId },
      });
      if (promo.perUserLimit && userRedemptions >= promo.perUserLimit)
        throw new ConflictException('You have already used this promo code.');

      await tx.promoRedemption.create({ data: { promoCodeId: promo.id, userId } });

      // Enlist in this transaction: the redemption row and the coins must commit
      // together, and a nested transaction would deadlock against it.
      return this.wallet.credit(
        {
          userId,
          amount: promo.rewardAmount,
          type: LedgerType.PROMO,
          sourceType: LEDGER_SOURCE.PROMO_CODE,
          sourceId: promo.id,
          idempotencyKey,
          actorType: ActorType.SYSTEM,
          actorId: null,
          metadata: { code: promo.code },
        },
        tx,
      );
    });
  }

  async getMissions(userId: string) {
    const missions = await this.prisma.mission.findMany({
      where: { enabled: true },
      include: {
        userMissions: { where: { userId } },
      },
    });

    return missions.map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      description: m.description,
      rewardAmount: m.rewardAmount.toString(),
      progress: m.userMissions[0]?.progress ?? 0,
      target: m.userMissions[0]?.target ?? 1,
      completedAt: m.userMissions[0]?.completedAt ?? null,
      claimedAt: m.userMissions[0]?.claimedAt ?? null,
    }));
  }

  async getAchievements(userId: string) {
    return this.prisma.achievement.findMany({
      where: { enabled: true },
      include: { userAchievements: { where: { userId } } },
    });
  }
}
