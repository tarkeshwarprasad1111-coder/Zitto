import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import {
  DailyRewardResultDto,
  LedgerPageDto,
  LedgerQueryDto,
  PromoRedemptionResultDto,
  RedeemPromoDto,
  WalletBalanceDto,
} from './dto/wallet.dto';
import { WalletService } from './wallet.service';

/**
 * Wallet endpoints.
 *
 * Every coin figure in every response is a **decimal string**, not a JSON number.
 * Balances exceed the safe-integer range for float parsers only rarely, but the
 * contract is uniform so clients never have to special-case.
 */
@ApiTags('Wallet')
@ApiBearerAuth('bearer')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({
    summary: 'Current balance',
    description: 'Returns total, locked, bonus, and available coin balances.',
  })
  @ApiOkResponse({ type: WalletBalanceDto })
  async getWallet(@CurrentUser('id') userId: string): Promise<WalletBalanceDto> {
    const wallet = await this.walletService.getBalance(userId);

    return {
      walletId: wallet.walletId,
      balance: wallet.balance.toString(),
      locked: wallet.locked.toString(),
      bonus: wallet.bonus.toString(),
      available: wallet.available.toString(),
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }

  @Get('ledger')
  @ApiOperation({
    summary: 'Ledger history',
    description:
      'Immutable, append-only record of every coin movement, newest first. Cursor paginated and filterable by type, source and date range.',
  })
  @ApiOkResponse({ type: LedgerPageDto })
  async getLedger(
    @CurrentUser('id') userId: string,
    @Query() query: LedgerQueryDto,
  ): Promise<LedgerPageDto> {
    const page = await this.walletService.getLedger(userId, query.cursor, query.limit, {
      type: query.type,
      sourceType: query.sourceType,
      from: query.from,
      to: query.to,
    });

    return {
      items: page.items.map((entry) => ({
        id: entry.id,
        type: entry.type,
        amount: entry.amount.toString(),
        balanceBefore: entry.balanceBefore.toString(),
        balanceAfter: entry.balanceAfter.toString(),
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        createdAt: entry.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      limit: page.limit,
    };
  }

  @Post('claim-daily-reward')
  @HttpCode(HttpStatus.OK)
  @Idempotent({ required: false })
  @ApiOperation({
    summary: 'Claim the daily reward',
    description:
      'Grants the once-per-day coin reward. Idempotent per calendar day in the account timezone — a second call the same day returns `claimed: false` with the original figures rather than an error.',
  })
  @ApiOkResponse({ type: DailyRewardResultDto })
  async claimDailyReward(@CurrentUser('id') userId: string): Promise<DailyRewardResultDto> {
    const result = await this.walletService.claimDailyReward(userId);

    return {
      claimed: result.claimed,
      amount: result.amount.toString(),
      balance: result.balance.toString(),
      day: result.day,
    };
  }

  @Post('redeem-promo')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({
    summary: 'Redeem a promo code',
    description:
      'Validates the code is enabled, inside its active window, under its global cap and under the per-user cap, then credits the reward.',
  })
  @ApiOkResponse({ type: PromoRedemptionResultDto })
  @ApiUnprocessableEntityResponse({
    description: 'Code expired, exhausted, not yet active, or already redeemed by this user.',
  })
  async redeemPromo(
    @CurrentUser('id') userId: string,
    @Body() body: RedeemPromoDto,
  ): Promise<PromoRedemptionResultDto> {
    const result = await this.walletService.redeemPromo(userId, body.code);

    return {
      code: result.code,
      amount: result.amount.toString(),
      balance: result.balance.toString(),
    };
  }
}
