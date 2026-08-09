import { Module } from '@nestjs/common';

import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

/**
 * Exports `WalletService` because Auth (signup bonus) and Game (bet stakes,
 * payouts) must move coins through it — never by touching balances directly.
 */
@Module({
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
