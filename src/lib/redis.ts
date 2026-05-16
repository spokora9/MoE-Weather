import { Redis } from 'ioredis';
import { createLogger } from './logger.js';

const logger = createLogger('redis');

let _client: Redis | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export function getRedisClient(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (_client) return _client;

  try {
    _client = new Redis(process.env.REDIS_URL!, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });

    _client.on('connect', () => logger.info('Redis connected'));
    _client.on('error', (err: Error) => logger.error({ err }, 'Redis error'));
    _client.on('close', () => logger.warn('Redis connection closed'));

    return _client;
  } catch (err) {
    logger.error({ err }, 'Failed to create Redis client');
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
  }
}

export function isRedisConnected(): boolean {
  return _client?.status === 'ready';
}
