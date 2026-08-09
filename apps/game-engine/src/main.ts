import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import pino from 'pino';
import { config } from './config.js';
import { RoundScheduler, type RoundEvent } from './scheduler.js';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true } },
});

const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

/** Realtime fans these out to connected clients over its own subscriber. */
async function publish(event: RoundEvent): Promise<void> {
  await redis.publish('game:events', JSON.stringify(event));
}

const scheduler = new RoundScheduler(prisma, redis, logger, publish);

async function main(): Promise<void> {
  await prisma.$connect();
  logger.info('database connected');
  scheduler.start();
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  await scheduler.stop();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection');
});

main().catch((error) => {
  logger.fatal({ err: error }, 'game engine failed to start');
  process.exit(1);
});
