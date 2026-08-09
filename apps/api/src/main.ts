import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { patchNestJsSwagger } from 'nestjs-zod';

import { AppModule } from './app.module';
import { AuditService } from './common/audit/audit.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { AppConfigService } from './config/app-config.service';
import { PrismaService } from './prisma/prisma.service';

/**
 * Coins are BigInt end to end. Express serializes responses with JSON.stringify,
 * which throws on BigInt, so we teach BigInt to render as a decimal string.
 * Clients must parse coin fields as strings — never as JS numbers.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function toJSON(this: bigint): string {
  return this.toString();
};

const GLOBAL_PREFIX = 'api/v1';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Zod DTOs must be teachable to the OpenAPI generator before any module loads.
  patchNestJsSwagger();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // The RFC 7807 filter owns error shaping; Nest's default JSON body is bypassed.
    abortOnError: false,
  });

  const config = app.get(AppConfigService);

  app.setGlobalPrefix(GLOBAL_PREFIX, {
    exclude: ['health', 'health/ready'],
  });

  // Trust the first proxy hop so `req.ip` and rate limiting see the real client.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const allowedOrigins = config.corsOrigins;
  app.enableCors({
    origin: (origin, callback) => {
      // Same-origin and server-to-server calls arrive without an Origin header.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin "${origin}" is not permitted by CORS policy.`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'Idempotency-Key',
      'X-Device-Id',
      'Accept-Language',
    ],
    exposedHeaders: ['X-Request-Id', 'Idempotency-Replayed', 'Retry-After'],
    maxAge: 86_400,
  });

  // Validation is Zod-based and registered as an APP_PIPE in AppModule. A
  // class-validator ValidationPipe is deliberately NOT installed here: with
  // `whitelist: true` it would strip every property off Zod DTOs, which carry no
  // class-validator metadata.

  app.useGlobalFilters(new HttpExceptionFilter(config.isProduction));

  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new AuditInterceptor(app.get(AuditService), app.get(Reflector)),
  );

  app.enableShutdownHooks();
  app.get(PrismaService).enableShutdownHooks(app);

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Zitto API')
        .setDescription(
          [
            'Backend for the Zitto Dragon Tiger platform.',
            '',
            '**Virtual coins only.** No real-money wagering, deposits, or withdrawals.',
            '',
            '**Coin amounts are transported as decimal strings**, not JSON numbers, to',
            'avoid float precision loss. Parse them with a big-integer type.',
            '',
            '**Errors** follow RFC 7807 `application/problem+json`.',
            '',
            '**Mutating endpoints** accept an `Idempotency-Key` header; replays return the',
            'original response rather than repeating the action.',
            '',
            '**Analytics endpoints are descriptive, not predictive.** Every round is',
            'independent and historical patterns do not determine future outcomes.',
          ].join('\n'),
        )
        .setVersion('1.0')
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Access token from POST /auth/login.',
          },
          'bearer',
        )
        .addGlobalParameters({
          name: 'X-Request-Id',
          in: 'header',
          required: false,
          schema: { type: 'string' },
          description: 'Correlation id. Generated when omitted, and echoed on every response.',
        })
        .addServer(`${config.apiUrl}/${GLOBAL_PREFIX}`, 'Current environment')
        .addTag('Auth', 'Registration, verification, sessions')
        .addTag('Users', 'Profile, preferences, responsible gaming')
        .addTag('Wallet', 'Balance, ledger, rewards')
        .addTag('Game', 'Rooms, rounds, bets, provable fairness')
        .addTag('Analytics', 'Descriptive statistics and baseline estimates')
        .addTag('Health', 'Liveness and readiness')
        .build(),
      { operationIdFactory: (_controller, method) => method },
    );

    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
      customSiteTitle: 'Zitto API — Reference',
    });

    logger.log(`Swagger UI available at ${config.apiUrl}/docs`);
  }

  // Drain in-flight requests before the process exits.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      logger.log(`Received ${signal}, shutting down gracefully...`);
      void app.close().then(
        () => process.exit(0),
        (error: unknown) => {
          logger.error('Error during shutdown', error instanceof Error ? error.stack : String(error));
          process.exit(1);
        },
      );
    });
  }

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled promise rejection: ${String(reason)}`);
  });

  await app.listen(config.port, '0.0.0.0');

  logger.log(`Zitto API listening on port ${config.port} (${config.nodeEnv})`);
  logger.log(`Base path: ${config.apiUrl}/${GLOBAL_PREFIX}`);
}

void bootstrap();
