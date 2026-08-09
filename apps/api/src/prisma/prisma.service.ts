import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import { AppConfigService } from '../config/app-config.service';

/**
 * Application-wide Prisma client.
 *
 * Connects eagerly at boot so a bad `DATABASE_URL` fails the deploy rather than
 * the first request, and disconnects cleanly on shutdown so in-flight
 * transactions are not severed mid-write.
 */
@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'warn' | 'error'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfigService) {
    super({
      datasources: { db: { url: config.databaseUrl } },
      log: config.isDevelopment
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ],
      errorFormat: config.isProduction ? 'minimal' : 'pretty',
    });

    if (config.isDevelopment) {
      this.$on('query', (event) => {
        // Slow-query visibility during development only — query text can contain PII.
        if (event.duration >= 100) {
          this.logger.debug(`slow query ${event.duration}ms: ${event.query}`);
        }
      });
    }

    this.$on('warn', (event) => this.logger.warn(event.message));
    this.$on('error', (event) => this.logger.error(event.message));
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database connection closed.');
  }

  /**
   * Bridges Prisma's process-level shutdown signal into Nest's lifecycle so
   * `app.close()` runs `onModuleDestroy` on every provider.
   */
  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }

  /** Cheap round-trip used by the readiness probe. */
  async ping(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`;
    return true;
  }

  /**
   * Deletes every row in dependency order. Test-support only; refuses to run
   * outside `NODE_ENV=test` so it can never be reached in a real environment.
   */
  async truncateAllTables(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('truncateAllTables() is only available when NODE_ENV=test.');
    }

    const tables = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
    `;

    if (tables.length === 0) {
      return;
    }

    const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
    await this.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE;`);
  }
}
