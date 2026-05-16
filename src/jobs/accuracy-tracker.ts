/**
 * Forecast accuracy tracker.
 *
 * Two responsibilities:
 *
 * 1. recordForecast(): At forecast-creation time the caller hands us the
 *    predicted numeric value. We stash it in Redis with a 25h TTL keyed by
 *    {provider, metric, lat, lon, timestamp}. We pick 25h (not exactly 24)
 *    so the cleanup pass below has a one-hour grace window.
 *
 * 2. processStaleForecasts(): Once an hour we scan for keys whose embedded
 *    timestamp is now >= 24h old, fetch the actual current observation
 *    from Open-Meteo for that lat/lon, compute the error, write a row to
 *    `forecast_accuracy_log`, and delete the Redis key.
 *
 * The job is wired up via startJobs() in src/jobs/index.ts. It is safe to
 * call start() when Redis isn't configured - the job will simply log and
 * stay idle (no throws).
 */

import axios from 'axios';
import type { Redis } from 'ioredis';
import { getRedisClient, isRedisConfigured } from '../lib/redis.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createLogger } from '../lib/logger.js';
import type { AccuracyMetric } from '../lib/accuracy.js';
import type { WeatherProvider } from '../types/weather.js';

const logger = createLogger('accuracy-tracker');

const KEY_PREFIX = 'forecast:';
const TTL_SECONDS = 25 * 60 * 60; // 25h - one-hour grace window over the 24h target
const STALE_MS = 24 * 60 * 60 * 1000; // 24h
const HOUR_MS = 60 * 60 * 1000;

export interface RecordedForecast {
  provider: WeatherProvider;
  metric: AccuracyMetric;
  value: number;
  latitude: number;
  longitude: number;
  /** ms-since-epoch the forecast was issued for */
  forecastTime: number;
  /** ms-since-epoch the forecast targets (i.e. when the actual should be observed) */
  targetTime: number;
}

interface RedisLike {
  setex(key: string, ttl: number, value: string): Promise<unknown>;
  get(key: string): Promise<string | null>;
  keys(pattern: string): Promise<string[]>;
  del(...keys: string[]): Promise<number>;
}

type FetchActualFn = (
  latitude: number,
  longitude: number,
  metric: AccuracyMetric
) => Promise<number | null>;

export interface AccuracyTrackerOptions {
  /** Override the interval (ms). Defaults to one hour. */
  intervalMs?: number;
  /** Inject a custom Redis client (for tests). */
  redis?: RedisLike | null;
  /** Inject a custom actual-fetch fn (for tests). */
  fetchActual?: FetchActualFn;
}

/**
 * Default actual-value fetcher: queries Open-Meteo's `current` endpoint
 * for the requested metric. Returns null on any error (caller logs).
 */
async function defaultFetchActual(
  latitude: number,
  longitude: number,
  metric: AccuracyMetric
): Promise<number | null> {
  const fieldByMetric: Record<AccuracyMetric, string> = {
    temperature: 'temperature_2m',
    precipitation: 'precipitation',
    wind_speed: 'wind_speed_10m',
  };
  const field = fieldByMetric[metric];

  const url = 'https://api.open-meteo.com/v1/forecast';
  try {
    const res = await axios.get(url, {
      params: {
        latitude,
        longitude,
        current: field,
      },
      timeout: 10_000,
    });
    const value = res.data?.current?.[field];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return null;
  } catch (err) {
    logger.warn({ err, latitude, longitude, metric }, 'Failed to fetch actual');
    return null;
  }
}

export class AccuracyTracker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private readonly injectedRedis: RedisLike | null | undefined;
  private readonly fetchActual: FetchActualFn;

  constructor(opts: AccuracyTrackerOptions = {}) {
    this.intervalMs = opts.intervalMs ?? HOUR_MS;
    this.injectedRedis = opts.redis;
    this.fetchActual = opts.fetchActual ?? defaultFetchActual;
  }

  /** Return a Redis-shaped client, preferring the injected one. */
  private getRedis(): RedisLike | null {
    if (this.injectedRedis !== undefined) return this.injectedRedis;
    if (!isRedisConfigured()) return null;
    return getRedisClient() as unknown as Redis | null;
  }

  start(): void {
    if (this.timer) return;
    logger.info({ intervalMs: this.intervalMs }, 'Accuracy tracker starting');
    this.timer = setInterval(() => {
      this.processStaleForecasts().catch((err) =>
        logger.error({ err }, 'processStaleForecasts failed')
      );
    }, this.intervalMs);
    // Don't keep the event loop alive solely for this timer.
    if (typeof this.timer === 'object' && this.timer && 'unref' in this.timer) {
      (this.timer as { unref: () => void }).unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Accuracy tracker stopped');
    }
  }

  /**
   * Build the Redis key for a forecast. Coordinates are rounded to four
   * decimal places (~11 m) to keep keys stable across rounding noise.
   */
  static buildKey(
    provider: WeatherProvider,
    metric: AccuracyMetric,
    latitude: number,
    longitude: number,
    targetTime: number
  ): string {
    const lat = latitude.toFixed(4);
    const lon = longitude.toFixed(4);
    return `${KEY_PREFIX}${provider}:${metric}:${lat}:${lon}:${targetTime}`;
  }

  /**
   * Persist a forecast prediction to Redis with a 25h TTL.
   *
   * `targetTime` defaults to now+24h so processStaleForecasts picks it up
   * after one full day; callers may override (e.g. a +6h forecast).
   */
  async recordForecast(
    provider: WeatherProvider,
    metric: AccuracyMetric,
    value: number,
    latitude: number,
    longitude: number,
    targetTime: number = Date.now() + STALE_MS
  ): Promise<boolean> {
    const redis = this.getRedis();
    if (!redis) {
      logger.debug('Redis unavailable; skipping recordForecast');
      return false;
    }
    const forecastTime = Date.now();
    const payload: RecordedForecast = {
      provider,
      metric,
      value,
      latitude,
      longitude,
      forecastTime,
      targetTime,
    };
    const key = AccuracyTracker.buildKey(provider, metric, latitude, longitude, targetTime);
    try {
      await redis.setex(key, TTL_SECONDS, JSON.stringify(payload));
      return true;
    } catch (err) {
      logger.warn({ err, key }, 'Failed to record forecast in Redis');
      return false;
    }
  }

  /**
   * Scan Redis for forecasts whose targetTime has elapsed, fetch the
   * matching actual observation, and write a row to forecast_accuracy_log.
   *
   * Returns the number of rows successfully written.
   */
  async processStaleForecasts(): Promise<number> {
    const redis = this.getRedis();
    if (!redis) {
      logger.debug('Redis unavailable; skipping processStaleForecasts');
      return 0;
    }
    if (!supabaseAdmin) {
      logger.debug('Supabase admin unavailable; skipping processStaleForecasts');
      return 0;
    }

    let keys: string[];
    try {
      keys = await redis.keys(`${KEY_PREFIX}*`);
    } catch (err) {
      logger.warn({ err }, 'Failed to scan Redis keys');
      return 0;
    }

    const now = Date.now();
    let written = 0;

    for (const key of keys) {
      let raw: string | null;
      try {
        raw = await redis.get(key);
      } catch (err) {
        logger.warn({ err, key }, 'Failed to read forecast key');
        continue;
      }
      if (!raw) continue;

      let payload: RecordedForecast;
      try {
        payload = JSON.parse(raw) as RecordedForecast;
      } catch (err) {
        logger.warn({ err, key }, 'Corrupt forecast payload, deleting');
        await redis.del(key).catch(() => undefined);
        continue;
      }

      if (payload.targetTime > now) {
        // Not yet stale.
        continue;
      }

      const actual = await this.fetchActual(
        payload.latitude,
        payload.longitude,
        payload.metric
      );
      if (actual === null) {
        // Leave the key for the next pass; TTL will eventually cull it.
        continue;
      }

      const row = {
        provider: payload.provider,
        latitude: payload.latitude,
        longitude: payload.longitude,
        forecast_time: new Date(payload.forecastTime).toISOString(),
        target_time: new Date(payload.targetTime).toISOString(),
        metric: payload.metric,
        predicted_value: payload.value,
        actual_value: actual,
      };

      const { error } = await supabaseAdmin.from('forecast_accuracy_log').insert(row);
      if (error) {
        logger.warn({ err: error, key }, 'Failed to insert accuracy row');
        continue;
      }

      await redis.del(key).catch((err: unknown) =>
        logger.warn({ err, key }, 'Failed to delete processed key')
      );
      written++;
    }

    if (written > 0) {
      logger.info({ written, scanned: keys.length }, 'Processed stale forecasts');
    }
    return written;
  }
}
