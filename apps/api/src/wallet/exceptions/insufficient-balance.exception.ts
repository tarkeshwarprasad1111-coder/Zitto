import { HttpStatus } from '@nestjs/common';

import { DomainException } from '../../common/exceptions/domain.exception';
import { formatCoins } from '../../common/utils/coins';

/**
 * Raised when a debit would drive a wallet below zero.
 *
 * Carries the exact figures so the client can render a precise message and offer
 * the right remedy (claim daily reward, redeem a promo) without a second call.
 * Amounts are decimal strings — never JSON numbers.
 */
export class InsufficientBalanceException extends DomainException {
  readonly code = 'INSUFFICIENT_BALANCE';
  readonly status = HttpStatus.UNPROCESSABLE_ENTITY;
  readonly title = 'Insufficient Balance';

  readonly requiredCoins: string;
  readonly availableCoins: string;
  readonly shortfallCoins: string;

  constructor(params: { required: bigint; available: bigint }) {
    const shortfall = params.required - params.available;

    super(
      `This action needs ${formatCoins(params.required)} coins but the wallet holds ${formatCoins(
        params.available,
      )}. Short by ${formatCoins(shortfall)}.`,
    );

    this.requiredCoins = params.required.toString();
    this.availableCoins = params.available.toString();
    this.shortfallCoins = shortfall.toString();
  }
}

/** Raised when a wallet row is missing for a user that should have one. */
export class WalletNotFoundException extends DomainException {
  readonly code = 'WALLET_NOT_FOUND';
  readonly status = HttpStatus.NOT_FOUND;
  readonly title = 'Wallet Not Found';

  constructor(userId: string) {
    super(`No wallet exists for user ${userId}.`);
  }
}

/** Raised when a caller passes a zero or negative amount to credit/debit. */
export class InvalidAmountException extends DomainException {
  readonly code = 'INVALID_AMOUNT';
  readonly status = HttpStatus.UNPROCESSABLE_ENTITY;
  readonly title = 'Invalid Amount';

  constructor(amount: bigint) {
    super(
      `Coin amounts must be positive integers; received ${amount.toString()}. Direction is expressed by calling credit() or debit(), not by the sign.`,
    );
  }
}
