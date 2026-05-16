/**
 * Tests for elevation correction helpers.
 *
 * Covers:
 *   - getElevation: API success, payload validation, Redis cache hit, memory cache hit
 *   - applyLapseRate: ascent, descent, no-op
 *   - shouldApplyCorrection: above/below threshold, descent, exactly at threshold
 *   - correctTemperature: integration on Aspen-like coords, graceful degradation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../test/setup.js';

// ---------------------------------------------------------------------------
// Mock the Redis client BEFORE importing the module under test so the
// module's `getRedisClient` import resolves to our mock factory.
// ---------------------------------------------------------------------------
const redisGet = vi.fn();
const redisSet = vi.fn();
let redisClientValue: { get: typeof redisGet; set: typeof redisSet } | null = null;

vi.mock('../redis.js', () => ({
  getRedisClient: () => redisClientValue,
  isRedisConfigured: () => redisClientValue !== null,
  isRedisConnected: () => redisClientValue !== null,
  closeRedis: async () => {
    /* no-op */
  },
}));

// Imported after mocks are registered.
import {
  applyLapseRate,
  correctTemperature,
  ELEVATION_DELTA_THRESHOLD_M,
  LAPSE_RATE_C_PER_M,
  getElevation,
  shouldApplyCorrection,
  _clearElevationMemoryCache,
} from '../elevation.js';

const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';

// Aspen, CO — about 2400m elevation per SRTM.
const ASPEN_LAT = 39.19;
const ASPEN_LON = -106.82;
const ASPEN_ELEVATION = 2438;

beforeEach(() => {
  _clearElevationMemoryCache();
  redisGet.mockReset();
  redisSet.mockReset();
  redisClientValue = null;
});

// ---------------------------------------------------------------------------
// applyLapseRate
// ---------------------------------------------------------------------------

describe('applyLapseRate', () => {
  it('cools temperature when ascending (20C at sea level -> 13.5C at 1000m)', () => {
    expect(applyLapseRate(20, 0, 1000)).toBeCloseTo(13.5, 6);
  });

  it('warms temperature when descending (10C at 3000m -> 29.5C at sea level)', () => {
    expect(applyLapseRate(10, 3000, 0)).toBeCloseTo(29.5, 6);
  });

  it('returns the input unchanged when station and query are co-elevation', () => {
    expect(applyLapseRate(15, 500, 500)).toBe(15);
  });

  it('handles small ascents (15C at 500m -> 14.35C at 600m)', () => {
    expect(applyLapseRate(15, 500, 600)).toBeCloseTo(14.35, 6);
  });

  it('uses the documented ICAO lapse rate constant', () => {
    expect(LAPSE_RATE_C_PER_M).toBeCloseTo(0.0065, 10);
  });
});

// ---------------------------------------------------------------------------
// shouldApplyCorrection
// ---------------------------------------------------------------------------

describe('shouldApplyCorrection', () => {
  it('returns false when delta is 50m (below threshold)', () => {
    expect(shouldApplyCorrection(1000, 1050)).toBe(false);
  });

  it('returns true when delta is 200m (above threshold)', () => {
    expect(shouldApplyCorrection(1000, 1200)).toBe(true);
  });

  it('returns true regardless of direction (negative delta)', () => {
    expect(shouldApplyCorrection(2400, 1900)).toBe(true);
  });

  it('returns false at exactly the threshold (uses strict greater-than)', () => {
    expect(shouldApplyCorrection(0, ELEVATION_DELTA_THRESHOLD_M)).toBe(false);
  });

  it('returns true for one metre over the threshold', () => {
    expect(shouldApplyCorrection(0, ELEVATION_DELTA_THRESHOLD_M + 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getElevation
// ---------------------------------------------------------------------------

describe('getElevation', () => {
  it('fetches from the Open-Meteo elevation API on a cache miss', async () => {
    mswServer.use(
      http.get(ELEVATION_URL, () =>
        HttpResponse.json({ elevation: [ASPEN_ELEVATION] })
      )
    );

    const result = await getElevation(ASPEN_LAT, ASPEN_LON);
    expect(result).toBe(ASPEN_ELEVATION);
  });

  it('does not call the API a second time within the memory-cache TTL', async () => {
    let callCount = 0;
    mswServer.use(
      http.get(ELEVATION_URL, () => {
        callCount += 1;
        return HttpResponse.json({ elevation: [ASPEN_ELEVATION] });
      })
    );

    await getElevation(ASPEN_LAT, ASPEN_LON);
    await getElevation(ASPEN_LAT, ASPEN_LON);
    await getElevation(ASPEN_LAT, ASPEN_LON);

    expect(callCount).toBe(1);
  });

  it('uses Redis cached value when present (skips HTTP entirely)', async () => {
    redisClientValue = { get: redisGet, set: redisSet };
    redisGet.mockResolvedValue(String(ASPEN_ELEVATION));

    let apiHit = false;
    mswServer.use(
      http.get(ELEVATION_URL, () => {
        apiHit = true;
        return HttpResponse.json({ elevation: [9999] });
      })
    );

    const result = await getElevation(ASPEN_LAT, ASPEN_LON);
    expect(result).toBe(ASPEN_ELEVATION);
    expect(apiHit).toBe(false);
    expect(redisGet).toHaveBeenCalledTimes(1);
    // Cache key should include the rounded coordinates.
    const calledKey = redisGet.mock.calls[0][0] as string;
    expect(calledKey).toContain('elevation:');
    expect(calledKey).toContain('39.19');
    expect(calledKey).toContain('-106.82');
  });

  it('writes the API result back to Redis with a 30-day TTL', async () => {
    redisClientValue = { get: redisGet, set: redisSet };
    redisGet.mockResolvedValue(null);
    redisSet.mockResolvedValue('OK');

    mswServer.use(
      http.get(ELEVATION_URL, () =>
        HttpResponse.json({ elevation: [ASPEN_ELEVATION] })
      )
    );

    await getElevation(ASPEN_LAT, ASPEN_LON);

    // Allow the fire-and-forget Redis set to resolve.
    await new Promise((r) => setImmediate(r));

    expect(redisSet).toHaveBeenCalledTimes(1);
    const [, value, mode, ttl] = redisSet.mock.calls[0];
    expect(value).toBe(String(ASPEN_ELEVATION));
    expect(mode).toBe('EX');
    expect(ttl).toBe(60 * 60 * 24 * 30);
  });

  it('falls back to the API when Redis get throws', async () => {
    redisClientValue = { get: redisGet, set: redisSet };
    redisGet.mockRejectedValue(new Error('boom'));
    redisSet.mockResolvedValue('OK');

    mswServer.use(
      http.get(ELEVATION_URL, () =>
        HttpResponse.json({ elevation: [ASPEN_ELEVATION] })
      )
    );

    const result = await getElevation(ASPEN_LAT, ASPEN_LON);
    expect(result).toBe(ASPEN_ELEVATION);
  });

  it('throws when the API returns an HTTP error', async () => {
    mswServer.use(
      http.get(ELEVATION_URL, () => new HttpResponse(null, { status: 503 }))
    );

    await expect(getElevation(ASPEN_LAT, ASPEN_LON)).rejects.toThrow(/503/);
  });

  it('throws when the API returns a malformed payload', async () => {
    mswServer.use(
      http.get(ELEVATION_URL, () => HttpResponse.json({ elevation: [] }))
    );

    await expect(getElevation(ASPEN_LAT, ASPEN_LON)).rejects.toThrow(/malformed/i);
  });
});

// ---------------------------------------------------------------------------
// correctTemperature
// ---------------------------------------------------------------------------

describe('correctTemperature', () => {
  it('applies a lapse-rate correction for Aspen-like coordinates', async () => {
    mswServer.use(
      http.get(ELEVATION_URL, () =>
        HttpResponse.json({ elevation: [ASPEN_ELEVATION] })
      )
    );

    // Forecast from a station near 1900m reporting 20C.
    const stationElevation = 1900;
    const forecastTempC = 20;

    const corrected = await correctTemperature(
      forecastTempC,
      ASPEN_LAT,
      ASPEN_LON,
      stationElevation
    );

    const expectedDelta = ASPEN_ELEVATION - stationElevation; // 538m
    const expected = forecastTempC - expectedDelta * LAPSE_RATE_C_PER_M;
    expect(corrected).toBeCloseTo(expected, 6);
    // And materially cooler than the original.
    expect(corrected).toBeLessThan(forecastTempC);
  });

  it('returns the input unchanged when delta is below threshold', async () => {
    mswServer.use(
      http.get(ELEVATION_URL, () =>
        HttpResponse.json({ elevation: [1050] })
      )
    );

    const result = await correctTemperature(18, 0, 0, 1000);
    expect(result).toBe(18);
  });

  it('gracefully degrades when the elevation API is down (returns original temp)', async () => {
    mswServer.use(
      http.get(ELEVATION_URL, () => HttpResponse.error())
    );

    const result = await correctTemperature(20, ASPEN_LAT, ASPEN_LON, 1900);
    expect(result).toBe(20);
  });

  it('gracefully degrades on malformed API payloads', async () => {
    mswServer.use(
      http.get(ELEVATION_URL, () => HttpResponse.json({ wrong: 'shape' }))
    );

    const result = await correctTemperature(20, ASPEN_LAT, ASPEN_LON, 1900);
    expect(result).toBe(20);
  });
});
