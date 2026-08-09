import { Global, Module } from '@nestjs/common';

import { RedisService } from './redis.service';

/** Global — idempotency, OTP cooldowns, and caches all reach for it. */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
