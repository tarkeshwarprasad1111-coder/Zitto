import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { RequestContext, RequestContextData } from '../common/decorators/request-context.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { RewardsService } from './rewards.service';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

class RedeemPromoDto extends createZodDto(z.object({ code: z.string().min(1).max(32) })) {}

@ApiTags('Rewards')
@ApiBearerAuth('bearer')
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Post('daily-reward')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({ summary: 'Claim daily login reward (once per calendar day)' })
  claimDaily(
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.rewards.claimDailyReward(user.id, ctx.idempotencyKey ?? user.id);
  }

  @Post('promo')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({ summary: 'Redeem a promo code' })
  redeem(
    @Body() dto: RedeemPromoDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() ctx: RequestContextData,
  ) {
    return this.rewards.redeemPromo(user.id, dto.code, ctx.idempotencyKey ?? user.id);
  }

  @Get('missions')
  @ApiOperation({ summary: "User's mission progress" })
  missions(@CurrentUser() user: AuthenticatedUser) {
    return this.rewards.getMissions(user.id);
  }

  @Get('achievements')
  @ApiOperation({ summary: "User's achievements" })
  achievements(@CurrentUser() user: AuthenticatedUser) {
    return this.rewards.getAchievements(user.id);
  }
}
