import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';

/**
 * In-memory cache for e2e tests (no Redis required).
 */
@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 60 * 1000,
    }),
  ],
  exports: [CacheModule],
})
export class TestCacheModule {}
