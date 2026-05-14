/**
 * Multi-tier Caching System
 * L1: In-memory (fast, limited capacity)
 * L2: File-based (optional, persistent)
 */

import NodeCache from 'node-cache';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('cache');

export interface CacheConfig {
  // L1 cache TTL in seconds
  l1Ttl: {
    current: number;
    hourly: number;
    daily: number;
    alerts: number;
    geocoding: number;
  };
  // Maximum number of keys in L1 cache
  maxKeys: number;
  // Check period for expired keys (seconds)
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
    current: 300,      // 5 minutes
    hourly: 1800,      // 30 minutes
    daily: 7200,       // 2 hours
    alerts: 60,        // 1 minute
    geocoding: 86400,  // 24 hours
  },
  maxKeys: 10000,
  checkPeriod: 120,
};

type CacheType = 'current' | 'hourly' | 'daily' | 'alerts' | 'geocoding';

export class CacheManager {
  private l1Cache: NodeCache;
  private config: CacheConfig;
  private stats: {
    hits: number;
    misses: number;
  };

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

    // Log cache key expirations at debug level
    this.l1Cache.on('expired', (key: string) => {
      logger.debug({ key }, 'Cache key expired');
    });
  }

  /**
   * Generate cache key for weather data
   */
  private generateKey(
    type: CacheType,
    lat: number,
    lon: number,
    extra?: string
  ): string {
    // Round coordinates to reduce cache fragmentation
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    const baseKey = `weather:${type}:${roundedLat}:${roundedLon}`;
    return extra ? `${baseKey}:${extra}` : baseKey;
  }

  /**
   * Get TTL for a specific cache type
   */
  private getTtl(type: CacheType): number {
    return this.config.l1Ttl[type];
  }

  /**
   * Get data from cache
   */
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

  /**
   * Set data in cache
   */
  set<T>(
    type: CacheType,
    lat: number,
    lon: number,
    data: T,
    extra?: string,
    customTtl?: number
  ): boolean {
    const key = this.generateKey(type, lat, lon, extra);
    const ttl = customTtl || this.getTtl(type);
    return this.l1Cache.set(key, data, ttl);
  }

  /**
   * Delete data from cache
   */
  delete(type: CacheType, lat: number, lon: number, extra?: string): boolean {
    const key = this.generateKey(type, lat, lon, extra);
    return this.l1Cache.del(key) > 0;
  }

  /**
   * Check if data exists in cache
   */
  has(type: CacheType, lat: number, lon: number, extra?: string): boolean {
    const key = this.generateKey(type, lat, lon, extra);
    return this.l1Cache.has(key);
  }

  /**
   * Get remaining TTL for a cached item
   */
  getTtlRemaining(
    type: CacheType,
    lat: number,
    lon: number,
    extra?: string
  ): number {
    const key = this.generateKey(type, lat, lon, extra);
    return this.l1Cache.getTtl(key) || 0;
  }

  /**
   * Flush all cached data
   */
  flush(): void {
    this.l1Cache.flushAll();
  }

  /**
   * Flush cached data for a specific type
   */
  flushType(type: CacheType): void {
    const keys = this.l1Cache.keys();
    const prefix = `weather:${type}:`;
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.l1Cache.del(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
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

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get all keys (for debugging)
   */
  getKeys(): string[] {
    return this.l1Cache.keys();
  }

  /**
   * Close the cache (cleanup)
   */
  close(): void {
    this.l1Cache.close();
  }
}

/**
 * Create a memoized function with caching
 */
export function memoize<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  keyGenerator: (...args: Args) => string,
  ttlSeconds: number
): (...args: Args) => Promise<T> {
  const cache = new NodeCache({ stdTTL: ttlSeconds });

  return async (...args: Args): Promise<T> => {
    const key = keyGenerator(...args);
    const cached = cache.get<T>(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = await fn(...args);
    cache.set(key, result);
    return result;
  };
}
