/**
 * Multi-tier Caching System
 * L1: In-memory (fast, always available)
 * L2: Redis (persistent, shared across instances — optional)
 */

import NodeCache from 'node-cache';
import { getRedisClient } from '../lib/redis.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('cache');

export interface CacheConfig {
  l1Ttl: {
    current: number;
    hourly: number;
    daily: number;
    alerts: number;
    geocoding: number;
  };
  maxKeys: number;
  checkPeriod: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  hitRate: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  l1Ttl: {
    current: 300,
    hourly: 1800,
    daily: 7200,
    alerts: 60,
    geocoding: 86400,
  },
  maxKeys: 10000,
  checkPeriod: 120,
};

type CacheType = 'current' | 'hourly' | 'daily' | 'alerts' | 'geocoding';

export class CacheManager {
  private l1Cache: NodeCache;
  private config: CacheConfig;
  private stats: { hits: number; misses: number };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      l1Ttl: { ...DEFAULT_CONFIG.l1Ttl, ...config.l1Ttl },
    };

    this.l1Cache = new NodeCache({
      stdTTL: this.config.l1Ttl.current,
      checkperiod: this.config.checkPeriod,
      maxKeys: this.config.maxKeys,
      useClones: true,
    });

    this.stats = { hits: 0, misses: 0 };

    this.l1Cache.on('expired', (key: string) => {
      logger.debug({ key }, 'L1 cache key expired');
    });
  }

  private generateKey(type: CacheType, lat: number, lon: number, extra?: string): string {
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    const base = `weather:${type}:${roundedLat}:${roundedLon}`;
    return extra ? `${base}:${extra}` : base;
  }

  private getTtl(type: CacheType): number {
    return this.config.l1Ttl[type];
  }

  get<T>(type: CacheType, lat: number, lon: number, extra?: string): T | null {
    const key = this.generateKey(type, lat, lon, extra);
    const value = this.l1Cache.get<T>(key);

    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }

    this.stats.misses++;
    return null;
  }

  async getAsync<T>(type: CacheType, lat: number, lon: number, extra?: string): Promise<T | null> {
    const l1 = this.get<T>(type, lat, lon, extra);
    if (l1 !== null) return l1;

    const redis = getRedisClient();
    if (!redis) return null;

    const key = this.generateKey(type, lat, lon, extra);
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      const value = JSON.parse(raw) as T;
      this.l1Cache.set(key, value, this.getTtl(type));
      this.stats.hits++;
      return value;
    } catch (err) {
      logger.warn({ err, key }, 'Redis get failed, falling back to miss');
      return null;
    }
  }

  set<T>(type: CacheType, lat: number, lon: number, data: T, extra?: string, customTtl?: number): boolean {
    const key = this.generateKey(type, lat, lon, extra);
    const ttl = customTtl || this.getTtl(type);
    const result = this.l1Cache.set(key, data, ttl);

    const redis = getRedisClient();
    if (redis) {
      redis.set(key, JSON.stringify(data), 'EX', ttl).catch((err: Error) => {
        logger.warn({ err, key }, 'Redis set failed');
      });
    }

    return result;
  }

  delete(type: CacheType, lat: number, lon: number, extra?: string): boolean {
    const key = this.generateKey(type, lat, lon, extra);
    const deleted = this.l1Cache.del(key) > 0;

    const redis = getRedisClient();
    if (redis) {
      redis.del(key).catch((err: Error) => logger.warn({ err, key }, 'Redis del failed'));
    }

    return deleted;
  }

  has(type: CacheType, lat: number, lon: number, extra?: string): boolean {
    const key = this.generateKey(type, lat, lon, extra);
    return this.l1Cache.has(key);
  }

  getTtlRemaining(type: CacheType, lat: number, lon: number, extra?: string): number {
    const key = this.generateKey(type, lat, lon, extra);
    return this.l1Cache.getTtl(key) || 0;
  }

  flush(): void {
    this.l1Cache.flushAll();
    const redis = getRedisClient();
    if (redis) {
      redis.flushdb().catch((err: Error) => logger.warn({ err }, 'Redis flush failed'));
    }
  }

  flushType(type: CacheType): void {
    const keys = this.l1Cache.keys();
    const prefix = `weather:${type}:`;
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.l1Cache.del(key);
      }
    }
  }

  getStats(): CacheStats {
    const keys = this.l1Cache.keys().length;
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      keys,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  getKeys(): string[] {
    return this.l1Cache.keys();
  }

  close(): void {
    this.l1Cache.close();
  }
}

export function memoize<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  keyGenerator: (...args: Args) => string,
  ttlSeconds: number
): (...args: Args) => Promise<T> {
  const cache = new NodeCache({ stdTTL: ttlSeconds });

  return async (...args: Args): Promise<T> => {
    const key = keyGenerator(...args);
    const cached = cache.get<T>(key);
    if (cached !== undefined) return cached;
    const result = await fn(...args);
    cache.set(key, result);
    return result;
  };
}
