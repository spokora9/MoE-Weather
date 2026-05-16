import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WeatherAlert, WeatherData } from '../../types/weather.js';

// ---------------------------------------------------------------------------
// Hoisted mock state (must be defined before vi.mock factories run)
// ---------------------------------------------------------------------------
const { mockFrom, mockRedis, redisStore, mockSendPush, redisFlag } = vi.hoisted(() => {
  const redisStore = new Map<string, string>();
  const mockRedis = {
    exists: vi.fn(async (key: string) => (redisStore.has(key) ? 1 : 0)),
    set: vi.fn(async (key: string, value: string) => {
      redisStore.set(key, value);
      return 'OK';
    }),
  };
  return {
    mockFrom: vi.fn(),
    mockRedis,
    redisStore,
    mockSendPush: vi.fn(),
    // Wrapped in a mutable object so the test file can toggle availability.
    redisFlag: { available: true },
  };
});

vi.mock('../../lib/supabase.js', () => ({
  supabaseAdmin: { from: mockFrom },
  supabase: null,
}));

vi.mock('../../lib/redis.js', () => ({
  getRedisClient: () => (redisFlag.available ? mockRedis : null),
}));

vi.mock('../../lib/push.js', () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPush(...args),
}));

// Import AFTER mocks
import { AlertPusher } from '../alert-pusher.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function alert(
  id: string,
  severity: WeatherAlert['severity'],
  overrides: Partial<WeatherAlert> = {},
): WeatherAlert {
  return {
    id,
    event: 'Test Event',
    headline: `Headline ${id}`,
    description: `Description ${id}`,
    severity,
    urgency: 'expected',
    start: new Date(),
    end: new Date(Date.now() + 3600_000),
    source: 'test',
    ...overrides,
  };
}

function weatherWith(alerts: WeatherAlert[]): WeatherData {
  return {
    location: { name: 'Test', country: 'XX', coordinates: { latitude: 0, longitude: 0 } },
    current: {} as never,
    hourly: [],
    daily: [],
    alerts,
    metadata: {} as never,
  };
}

// Two-stage chain — first call returns saved_locations, second returns push_subscriptions.
function setupFromForLocationsThenSubs(
  locations: Array<{ id: string; user_id: string; latitude: number; longitude: number; name: string }>,
  subsByUserId: Record<string, Array<{ endpoint: string; p256dh: string; auth: string }>>,
) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'saved_locations') {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => Promise.resolve({ data: locations, error: null }));
      return chain;
    }
    if (table === 'push_subscriptions') {
      // .select(...).eq('user_id', X) → resolve with that user's subs
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn((_col: string, userId: string) => {
        const data = (subsByUserId[userId] ?? []).map((s) => ({ user_id: userId, ...s }));
        return Object.assign(Promise.resolve({ data, error: null }), chain);
      });
      return chain;
    }
    return {};
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockFrom.mockReset();
  mockSendPush.mockReset();
  mockRedis.exists.mockClear();
  mockRedis.set.mockClear();
  redisStore.clear();
  redisFlag.available = true;
});

describe('AlertPusher.tick', () => {
  it('skips alerts below the severity threshold', async () => {
    setupFromForLocationsThenSubs(
      [{ id: 'l1', user_id: 'u1', latitude: 40, longitude: -75, name: 'NYC' }],
      { u1: [{ endpoint: 'https://push/x', p256dh: 'p', auth: 'a' }] },
    );
    const getWeather = vi.fn(async () => weatherWith([alert('a-minor', 'minor')]));
    mockSendPush.mockResolvedValue(true);

    const pusher = new AlertPusher(getWeather);
    const result = await pusher.tick();

    expect(result.alertsProcessed).toBe(0);
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('pushes alerts with severity >= moderate', async () => {
    setupFromForLocationsThenSubs(
      [{ id: 'l1', user_id: 'u1', latitude: 40, longitude: -75, name: 'NYC' }],
      { u1: [{ endpoint: 'https://push/x', p256dh: 'p', auth: 'a' }] },
    );
    const getWeather = vi.fn(async () =>
      weatherWith([alert('a1', 'moderate'), alert('a2', 'severe'), alert('a3', 'extreme')]),
    );
    mockSendPush.mockResolvedValue(true);

    const pusher = new AlertPusher(getWeather);
    const result = await pusher.tick();

    expect(result.alertsProcessed).toBe(3);
    expect(result.pushesSent).toBe(3);
    expect(mockSendPush).toHaveBeenCalledTimes(3);
  });

  it('dedupes the same alert across two ticks', async () => {
    const setupForTick = () =>
      setupFromForLocationsThenSubs(
        [{ id: 'l1', user_id: 'u1', latitude: 40, longitude: -75, name: 'NYC' }],
        { u1: [{ endpoint: 'https://push/x', p256dh: 'p', auth: 'a' }] },
      );
    const getWeather = vi.fn(async () => weatherWith([alert('repeat-1', 'severe')]));
    mockSendPush.mockResolvedValue(true);

    const pusher = new AlertPusher(getWeather);

    setupForTick();
    const first = await pusher.tick();
    expect(first.pushesSent).toBe(1);
    expect(first.deduped).toBe(0);

    setupForTick();
    const second = await pusher.tick();
    expect(second.deduped).toBe(1);
    expect(second.pushesSent).toBe(0);
    expect(mockSendPush).toHaveBeenCalledTimes(1); // not called again
  });

  it('handles multiple users at the same coordinate', async () => {
    setupFromForLocationsThenSubs(
      [
        { id: 'l1', user_id: 'u1', latitude: 40, longitude: -75, name: 'NYC' },
        { id: 'l2', user_id: 'u2', latitude: 40, longitude: -75, name: 'NYC' },
      ],
      {
        u1: [{ endpoint: 'https://push/u1', p256dh: 'p1', auth: 'a1' }],
        u2: [{ endpoint: 'https://push/u2', p256dh: 'p2', auth: 'a2' }],
      },
    );
    const getWeather = vi.fn(async () => weatherWith([alert('shared', 'severe')]));
    mockSendPush.mockResolvedValue(true);

    const pusher = new AlertPusher(getWeather);
    const result = await pusher.tick();

    expect(getWeather).toHaveBeenCalledTimes(1); // shared coordinate
    expect(result.pushesSent).toBe(2);
  });

  it('returns zero counts when there are no saved_locations', async () => {
    setupFromForLocationsThenSubs([], {});
    const getWeather = vi.fn();

    const pusher = new AlertPusher(getWeather);
    const result = await pusher.tick();

    expect(result).toEqual({ alertsProcessed: 0, pushesSent: 0, deduped: 0 });
    expect(getWeather).not.toHaveBeenCalled();
  });

  it('continues to next location if getWeather throws', async () => {
    setupFromForLocationsThenSubs(
      [
        { id: 'l1', user_id: 'u1', latitude: 40, longitude: -75, name: 'A' },
        { id: 'l2', user_id: 'u2', latitude: 50, longitude: 10, name: 'B' },
      ],
      {
        u2: [{ endpoint: 'https://push/u2', p256dh: 'p', auth: 'a' }],
      },
    );
    const getWeather = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(weatherWith([alert('b1', 'severe')]));
    mockSendPush.mockResolvedValue(true);

    const pusher = new AlertPusher(getWeather);
    const result = await pusher.tick();

    expect(result.pushesSent).toBe(1);
  });

  it('still works (without dedupe) when Redis is not configured', async () => {
    redisFlag.available = false;
    setupFromForLocationsThenSubs(
      [{ id: 'l1', user_id: 'u1', latitude: 40, longitude: -75, name: 'NYC' }],
      { u1: [{ endpoint: 'https://push/x', p256dh: 'p', auth: 'a' }] },
    );
    const getWeather = vi.fn(async () => weatherWith([alert('a1', 'severe')]));
    mockSendPush.mockResolvedValue(true);

    const pusher = new AlertPusher(getWeather);
    const result1 = await pusher.tick();
    expect(result1.pushesSent).toBe(1);

    // Re-run — no dedupe, so it sends again.
    setupFromForLocationsThenSubs(
      [{ id: 'l1', user_id: 'u1', latitude: 40, longitude: -75, name: 'NYC' }],
      { u1: [{ endpoint: 'https://push/x', p256dh: 'p', auth: 'a' }] },
    );
    const result2 = await pusher.tick();
    expect(result2.pushesSent).toBe(1);
    expect(result2.deduped).toBe(0);
  });
});

describe('AlertPusher.start/stop', () => {
  it('start schedules a timer that stop clears', () => {
    vi.useFakeTimers();
    const getWeather = vi.fn(async () => weatherWith([]));
    const pusher = new AlertPusher(getWeather, { intervalMs: 1000 });

    pusher.start();
    pusher.stop();
    // No timers left — advancing time should not call getWeather.
    vi.advanceTimersByTime(5000);
    expect(getWeather).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
