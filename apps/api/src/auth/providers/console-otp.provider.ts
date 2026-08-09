import { Injectable, Logger } from '@nestjs/common';

import type { Channel } from '../dto/auth.dto';
import type { OtpProvider, OtpPurpose } from '../otp.service';

/**
 * Development delivery adapter: prints the code to the server log.
 *
 * Guarded so it can never run in production — a provider that leaks live codes
 * into logs would be a credential disclosure. `AuthModule` selects the adapter by
 * `OTP_PROVIDER` env var, and this class refuses to start under NODE_ENV=production.
 */
@Injectable()
export class ConsoleOtpProvider implements OtpProvider {
  readonly name = 'console';

  private readonly logger = new Logger(ConsoleOtpProvider.name);

  constructor(isProduction: boolean) {
    if (isProduction) {
      throw new Error(
        'ConsoleOtpProvider must not be used in production — configure a real OTP_PROVIDER.',
      );
    }
  }

  async send(params: {
    channel: Channel;
    target: string;
    code: string;
    ttlSeconds: number;
    purpose: OtpPurpose;
  }): Promise<void> {
    const minutes = Math.round(params.ttlSeconds / 60);

    this.logger.warn(
      [
        '',
        '  ┌─────────────────────────────────────────────┐',
        '  │  DEV OTP — not delivered to a real channel  │',
        '  ├─────────────────────────────────────────────┤',
        `  │  purpose : ${params.purpose.padEnd(31)}│`,
        `  │  channel : ${params.channel.padEnd(31)}│`,
        `  │  target  : ${params.target.slice(0, 31).padEnd(31)}│`,
        `  │  code    : ${params.code.padEnd(31)}│`,
        `  │  expires : ${`${minutes} minute${minutes === 1 ? '' : 's'}`.padEnd(31)}│`,
        '  └─────────────────────────────────────────────┘',
        '',
      ].join('\n'),
    );

    return Promise.resolve();
  }
}

/**
 * Silently discards codes. For automated tests that assert on `VerificationRecord`
 * rows rather than on delivery.
 */
@Injectable()
export class NoopOtpProvider implements OtpProvider {
  readonly name = 'noop';

  async send(): Promise<void> {
    return Promise.resolve();
  }
}
