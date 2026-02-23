import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';

const logger = new Logger('AppCacheModule');

/**
 * Tries to connect to Redis and returns a Redis store if available,
 * otherwise falls back to the default in-memory store.
 *
 * This keeps development smooth: the app still works without Docker/Redis
 * running; cached values just won't persist between restarts.
 */
async function buildStores(
  configService: ConfigService,
): Promise<Record<string, unknown>> {
  const host = configService.get<string>('REDIS_HOST') ?? 'localhost';
  const port = configService.get<string>('REDIS_PORT') ?? '6379';
  const db = configService.get<string>('REDIS_DB') ?? '0';
  const url = `redis://${host}:${port}/${db}`;

  try {
    const store = new KeyvRedis(url);
    // Probe the connection before committing to it.
    await store.get('__probe__');
    logger.log(`Redis cache active (${host}:${port})`);
    return { stores: [store] };
  } catch {
    logger.warn(
      `Redis not reachable at ${url} – falling back to in-memory cache. ` +
        'Start Redis (or run docker compose up) for persistent caching.',
    );
    return {};
  }
}

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: async (configService: ConfigService) => {
        const storeConfig = await buildStores(configService);
        return {
          ttl: 60 * 60, // 1 hour
          ...storeConfig,
        };
      },
    }),
  ],
  exports: [CacheModule],
})
export class AppCacheModule {}
