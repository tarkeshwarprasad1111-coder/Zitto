import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { RewardsModule } from './rewards/rewards.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { AdminModule } from './admin/admin.module';
import { CommonModule } from './common/common.module';
import { HEADER } from './common/constants';
import { IdempotencyGuard } from './common/guards/idempotency.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { IdempotencyMiddleware } from './common/middleware/idempotency.middleware';
import { AppConfigService } from './config/app-config.service';
import { AppConfigModule } from './config/config.module';
import { validateEnv } from './config/env.validation';
import { GameModule } from './game/game.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';

/**
 * Composition root.
 *
 * Guard order is significant and matches the array below:
 *   1. ThrottlerGuard     — cheapest rejection first.
 *   2. JwtAuthGuard       — establishes `request.user`.
 *   3. RolesGuard         — needs `request.user`.
 *   4. IdempotencyGuard   — only worth checking on requests that will be served.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: ['.env.local', '.env', '../../.env'],
      validate: validateEnv,
    }),

    AppConfigModule,

    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          // Correlate every log line with the request that produced it.
          genReqId: (req) => (req.headers[HEADER.REQUEST_ID] as string | undefined) ?? undefined,
          transport: config.isProduction
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.newPassword',
              'req.body.code',
              'res.headers["set-cookie"]',
            ],
            remove: true,
          },
          autoLogging: {
            ignore: (req) => req.url === '/health' || req.url === '/health/ready',
          },
        },
      }),
    }),

    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.throttle.ttlSeconds * 1000,
            limit: config.throttle.limit,
          },
        ],
      }),
    }),

    // Infrastructure
    PrismaModule,
    RedisModule,
    CommonModule,

    // Features
    AuthModule,
    UsersModule,
    WalletModule,
    GameModule,
    AnalyticsModule,
    HealthModule,
    RewardsModule,
    TournamentsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: IdempotencyGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Replay protection sits in front of every mutating route. It is a no-op for
    // requests that carry no Idempotency-Key.
    consumer
      .apply(IdempotencyMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/ready', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
