import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AppConfigService } from '../config/app-config.service';
import { WalletModule } from '../wallet/wallet.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OTP_PROVIDER, OtpService, type OtpProvider } from './otp.service';
import { ConsoleOtpProvider, NoopOtpProvider } from './providers/console-otp.provider';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

/**
 * Authentication.
 *
 * The OTP delivery adapter is selected at boot from `OTP_PROVIDER`. Adding a real
 * channel (SES, Twilio, MSG91) means writing one class that implements
 * `OtpProvider` and extending the switch below — no OTP logic changes.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    // Secrets are passed per-sign/verify call in TokenService, because access and
    // refresh tokens deliberately use different keys.
    JwtModule.register({}),
    WalletModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    OtpService,
    JwtStrategy,
    {
      provide: OTP_PROVIDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): OtpProvider => {
        switch (config.otp.provider) {
          case 'noop':
            return new NoopOtpProvider();
          case 'console':
          default:
            return new ConsoleOtpProvider(config.isProduction);
        }
      },
    },
  ],
  exports: [AuthService, TokenService, OtpService],
})
export class AuthModule {}
