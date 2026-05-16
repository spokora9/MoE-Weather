import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// In-memory Supabase mock: every insert is captured for assertion.
const insertedRows: unknown[] = [];
const supabaseInsertError: { error: Error | null } = { error: null };

vi.mock('../../lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn().mockImplementation(() => ({
      insert: vi.fn().mockImplementation(async (row: unknown) => {
        if (supabaseInsertError.error) return { error: supabaseInsertError.error };
        insertedRows.push(row);
        return { error: null };
      }),
    })),
  },
}));

// We don't rely on the real Redis client - the tracker accepts an injected
// RedisLike. Stub the module so isRedisConfigured() never matters.
vi.mock('../../lib/redis.js', () => ({
  getRedisClient: vi.fn().mockReturnValue(null),
  isRedisConfigured: vi.fn().mockReturnValue(false),
}));

import { AccuracyTracker } from '../accuracy-tracker.js';

class FakeRedis {
  store = new Map<string, string>();

  async setex(key: string, _ttl: number, value: string): Promise<'OK'> {
    this.store.set(key, value);
    return 'OK';
  }
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async keys(pattern: string): Promise<string[]> {
    // Convert glob-ish "forecast:*" into a prefix scan; we only support trailing *.
    const prefix = pattern.replace(/\*$/, '');
    return Array.from(this.store.keys()).filter((k) => k.startsWith(prefix));
  }
  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) if (this.store.delete(k)) n++;
    return n;
  }
}

beforeEach(() => {
  insertedRows.length = 0;
  supabaseInsertError.error = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AccuracyTracker.buildKey', () => {
  it('rounds coords to 4dp and includes all fields', () => {
    const k = AccuracyTracker.buildKey('open-meteo', 'temperature', 40.71283, -74.00601, 1700000000000);
    expect(k).toBe('forecast:open-meteo:temperature:40.7128:-74.0060:1700000000000');
  });
});

describe('recordForecast', () => {
  it('stores a JSON payload in Redis under the canonical key', async () => {
    const redis = new FakeRedis();
    const tracker = new AccuracyTracker({ redis });

    const ok = await tracker.recordForecast(
      'open-meteo',
      'temperature',
      22.5,
      40.71,
      -74.01,
      1700000000000
    );
    expect(ok).toBe(true);

    const key = AccuracyTracker.buildKey(
      'open-meteo',
      'temperature',
      40.71,
      -74.01,
      1700000000000
    );
    const raw = await redis.get(key);
    expect(raw).not.toBeNull();
    const payload = JSON.parse(raw!);
    expect(payload).toMatchObject({
      provider: 'open-meteo',
      metric: 'temperature',
      value: 22.5,
      latitude: 40.71,
      longitude: -74.01,
      targetTime: 1700000000000,
    });
    expect(typeof payload.forecastTime).toBe('number');
  });

  it('returns false (no throw) when Redis is unavailable', async () => {
    const tracker = new AccuracyTracker({ redis: null });
    const ok = await tracker.recordForecast('open-meteo', 'temperature', 1, 0, 0);
    expect(ok).toBe(false);
  });

  it('defaults targetTime to ~24h in the future', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-16T12:00:00Z'));
    const redis = new FakeRedis();
    const tracker = new AccuracyTracker({ redis });
    await tracker.recordForecast('nws', 'temperature', 18, 41, -73);
    const keys = await redis.keys('forecast:*');
    expect(keys).toHaveLength(1);
    const payload = JSON.parse((await redis.get(keys[0]))!);
    const expectedTarget = new Date('2026-05-17T12:00:00Z').getTime();
    expect(payload.targetTime).toBe(expectedTarget);
  });
});

describe('processStaleForecasts', () => {
  it('skips forecasts whose targetTime is still in the future', async () => {
    const redis = new FakeRedis();
    const fetchActual = vi.fn().mockResolvedValue(20);
    const tracker = new AccuracyTracker({ redis, fetchActual });

    // targetTime 1 hour from now -> not stale.
    await tracker.recordForecast(
      'open-meteo',
      'temperature',
      20,
      40,
      -74,
      Date.now() + 60 * 60 * 1000
    );
    const written = await tracker.processStaleForecasts();
    expect(written).toBe(0);
    expect(fetchActual).not.toHaveBeenCalled();
    expect(insertedRows).toHaveLength(0);
  });

  it('writes a row and deletes the Redis key for 24h-old forecasts', async () => {
    const redis = new FakeRedis();
    const fetchActual = vi.fn().mockResolvedValue(19.4);
    const tracker = new AccuracyTracker({ redis, fetchActual });

    const targetTime = Date.now() - 60 * 1000; // 1 minute ago - stale
    await tracker.recordForecast(
      'open-meteo',
      'temperature',
      22.0,
      40.71,
      -74.01,
      targetTime
    );

    const written = await tracker.processStaleForecasts();
    expect(written).toBe(1);
    expect(fetchActual).toHaveBeenCalledWith(40.71, -74.01, 'temperature');
    expect(insertedRows).toHaveLength(1);
    const row = insertedRows[0] as Record<string, unknown>;
    expect(row.provider).toBe('open-meteo');
    expect(row.metric).toBe('temperature');
    expect(row.predicted_value).toBe(22.0);
    expect(row.actual_value).toBe(19.4);
    expect(typeof row.target_time).toBe('string');

    // Key should have been deleted.
    const keys = await redis.keys('forecast:*');
    expect(keys).toHaveLength(0);
  });

  it('leaves the key in place when fetchActual returns null', async () => {
    const redis = new FakeRedis();
    const fetchActual = vi.fn().mockResolvedValue(null);
    const tracker = new AccuracyTracker({ redis, fetchActual });

    await tracker.recordForecast(
      'nws',
      'temperature',
      10,
      41,
      -73,
      Date.now() - 1000
    );
    const written = await tracker.processStaleForecasts();
    expect(written).toBe(0);
    expect(insertedRows).toHaveLength(0);
    const keys = await redis.keys('forecast:*');
    expect(keys).toHaveLength(1);
  });

  it('removes corrupt payloads so they don\'t re-trigger', async () => {
    const redis = new FakeRedis();
    await redis.setex('forecast:bad', 60, 'not-json');
    const tracker = new AccuracyTracker({ redis, fetchActual: async () => 1 });
    const written = await tracker.processStaleForecasts();
    expect(written).toBe(0);
    const keys = await redis.keys('forecast:*');
    expect(keys).toHaveLength(0);
  });

  it('handles Supabase insert errors gracefully', async () => {
    const redis = new FakeRedis();
    const fetchActual = vi.fn().mockResolvedValue(5);
    const tracker = new AccuracyTracker({ redis, fetchActual });
    supabaseInsertError.error = new Error('db down');

    await tracker.recordForecast(
      'nws',
      'temperature',
      6,
      41,
      -73,
      Date.now() - 1000
    );
    const written = await tracker.processStaleForecasts();
    expect(written).toBe(0);
    // Key should NOT be deleted when insert fails.
    const keys = await redis.keys('forecast:*');
    expect(keys).toHaveLength(1);
  });

  it('returns 0 when Redis is unavailable', async () => {
    const tracker = new AccuracyTracker({ redis: null });
    const written = await tracker.processStaleForecasts();
    expect(written).toBe(0);
  });
});

describe('start/stop lifecycle', () => {
  it('start schedules processing on the configured interval and stop clears it', async () => {
    vi.useFakeTimers();
    const redis = new FakeRedis();
    const fetchActual = vi.fn().mockResolvedValue(10);
    const tracker = new AccuracyTracker({
      redis,
      fetchActual,
      intervalMs: 60_000,
    });

    const spy = vi.spyOn(tracker, 'processStaleForecasts');
    tracker.start();
    expect(spy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(spy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(spy).toHaveBeenCalledTimes(2);

    tracker.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('start is idempotent', () => {
    const tracker = new AccuracyTracker({ redis: new FakeRedis() });
    tracker.start();
    tracker.start();
    tracker.stop();
  });
});
