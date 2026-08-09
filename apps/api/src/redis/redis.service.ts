import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

import { AppConfigService } from '../config/app-config.service';

/** Handle returned by {@link RedisService.acquireLock}. */
export interface LockHandle {
  key: string;
  /** Random owner token — only the owner may release the lock. */
  token: string;
}

/**
 * Releases a lock only if we still own it. Prevents the classic bug where a lock
 * that expired mid-work gets deleted out from under its new owner.
 */
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

/**
 * Thin, typed wrapper over ioredis.
 *
 * Redis here is a cache and a coordination primitive — never a source of truth.
 * Money correctness lives in Postgres row locks; the lock helper below only
 * reduces contention and duplicate work.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: AppConfigService) {
    this.client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 200, 5_000),
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });
    this.client.on('ready', () => {
      this.logger.log('Redis connection ready.');
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /** Escape hatch for callers needing a raw command. Prefer the helpers below. */
  get raw(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** Reads and JSON-parses. Returns null on miss or unparseable content. */
  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      this.logger.warn(`Discarding unparseable cached value at key "${key}".`);
      await this.del(key);
      return null;
    }
  }

  /** Sets a value, optionally with a TTL in seconds. */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  /**
   * Sets only if the key does not exist. Returns true when this call created it —
   * the primitive behind idempotency reservations and locks.
   */
  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }
    return this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /** Increments and, on first write, applies a TTL — a fixed-window counter. */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return (await this.client.expire(key, ttlSeconds)) === 1;
  }

  /** Remaining TTL in seconds; -1 = no expiry, -2 = key absent. */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * Attempts to take a mutex via `SET key token NX PX ttl`.
   * Returns null if the lock is already held — callers decide whether to fail or retry.
   */
  async acquireLock(key: string, ttlMs = 10_000): Promise<LockHandle | null> {
    const token = uuidv4();
    const result = await this.client.set(key, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? { key, token } : null;
  }

  /** Releases a lock if and only if the caller still owns it. */
  async releaseLock(handle: LockHandle): Promise<boolean> {
    const released = await this.client.eval(RELEASE_SCRIPT, 1, handle.key, handle.token);
    return released === 1;
  }

  /**
   * Runs `fn` under a mutex, always releasing it.
   *
   * @throws the provided `onBusy` error when the lock cannot be taken.
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: { ttlMs?: number; onBusy?: () => Error } = {},
  ): Promise<T> {
    const handle = await this.acquireLock(key, options.ttlMs ?? 10_000);

    if (!handle) {
      throw options.onBusy?.() ?? new Error(`Could not acquire lock "${key}".`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(handle);
    }
  }

  /** Readiness probe. */
  async ping(): Promise<boolean> {
    return (await this.client.ping()) === 'PONG';
  }
}
