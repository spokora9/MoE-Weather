/**
 * Elevation correction for forecast temperatures.
 *
 * When a queried coordinate sits significantly higher or lower than the
 * weather station(s) used to forecast it (common in mountain locations),
 * surface temperatures can be off by several degrees. This module:
 *
 *  1. Resolves the true ground elevation for a coordinate via Open-Meteo's
 *     free Elevation API (SRTM/Copernicus DEM at ~90m resolution).
 *  2. Applies the ICAO standard atmospheric lapse rate (-6.5 degC per
 *     1000m ascent) to correct a forecast temperature for the elevation
 *     delta between the reporting station and the query coordinate.
 *
 * Elevation data is essentially static, so successful lookups are cached
 * in Redis (when configured) for 30 days, and in an in-memory map for
 * the lifetime of the process.
 *
 * Sample before/after (Aspen, CO ~2400m, station near 1900m, station T=20C):
 *   - shouldApplyCorrection(1900, 2400) === true  (delta 500m > 100m)
 *   - applyLapseRate(20, 1900, 2400) === 16.75    (20 - 0.5 * 6.5)
 *
 * If the Elevation API is unavailable, callers degrade gracefully:
 * `correctTemperature` returns the original temperature and the failure
 * is logged at warn level.
 */

import { createLogger } from './logger.js';
import { getRedisClient } from './redis.js';

const logger = createLogger('elevation');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** ICAO standard atmospheric lapse rate (degrees C per metre). */
export const LAPSE_RATE_C_PER_M = 6.5 / 1000;

/** Minimum elevation delta (metres) that triggers a correction. */
export const ELEVATION_DELTA_THRESHOLD_M = 100;

/** Redis TTL for elevation lookups (seconds). 30 days. */
export const ELEVATION_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Open-Meteo elevation endpoint. */
const ELEVATION_API_URL = 'https://api.open-meteo.com/v1/elevation';

/** Request timeout for the elevation API. */
const ELEVATION_API_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// In-memory cache (per-process, complements Redis)
// ---------------------------------------------------------------------------

const memoryCache = new Map<string, { value: number; expiresAt: number }>();

/**
 * Build a stable cache key for a coordinate. Coordinates are rounded to
 * 4 decimal places (~11m precision) so nearby lookups share an entry.
 */
function cacheKey(lat: number, lon: number): string {
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLon = Math.round(lon * 10000) / 10000;
  return `elevation:${roundedLat}:${roundedLon}`;
}

/**
 * For tests: clear the in-memory cache. Not exported for production use.
 * @internal
 */
export function _clearElevationMemoryCache(): void {
  memoryCache.clear();
}

// ---------------------------------------------------------------------------
// API response shape
// ---------------------------------------------------------------------------

interface OpenMeteoElevationResponse {
  elevation: number[];
}

function isValidElevationResponse(value: unknown): value is OpenMeteoElevationResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { elevation?: unknown };
  return (
    Array.isArray(v.elevation) &&
    v.elevation.length > 0 &&
    typeof v.elevation[0] === 'number' &&
    Number.isFinite(v.elevation[0])
  );
}

// ---------------------------------------------------------------------------
// Elevation lookup
// ---------------------------------------------------------------------------

/**
 * Resolve the ground elevation (metres above sea level) at the given
 * coordinate via the Open-Meteo Elevation API.
 *
 * Results are cached in Redis for 30 days (elevation does not change)
 * and additionally memoised in-process. On API failure the function
 * throws — callers wanting graceful degradation should use
 * {@link correctTemperature}.
 *
 * @example
 *   const aspen = await getElevation(39.19, -106.82); // ~2400
 */
export async function getElevation(lat: number, lon: number): Promise<number> {
  const key = cacheKey(lat, lon);
  const now = Date.now();

  // L1: in-memory
  const memHit = memoryCache.get(key);
  if (memHit && memHit.expiresAt > now) {
    return memHit.value;
  }

  // L2: Redis
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          memoryCache.set(key, {
            value: parsed,
            expiresAt: now + ELEVATION_CACHE_TTL_SECONDS * 1000,
          });
          return parsed;
        }
      }
    } catch (err) {
      logger.warn({ err, key }, 'Redis get failed for elevation lookup');
    }
  }

  // L3: fetch from Open-Meteo
  const url = `${ELEVATION_API_URL}?latitude=${lat}&longitude=${lon}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ELEVATION_API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `Open-Meteo elevation API returned ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();
  if (!isValidElevationResponse(data)) {
    throw new Error('Open-Meteo elevation API returned malformed payload');
  }

  const elevation = data.elevation[0];

  memoryCache.set(key, {
    value: elevation,
    expiresAt: now + ELEVATION_CACHE_TTL_SECONDS * 1000,
  });

  if (redis) {
    redis
      .set(key, String(elevation), 'EX', ELEVATION_CACHE_TTL_SECONDS)
      .catch((err: Error) => {
        logger.warn({ err, key }, 'Redis set failed for elevation lookup');
      });
  }

  return elevation;
}

// ---------------------------------------------------------------------------
// Lapse rate helpers
// ---------------------------------------------------------------------------

/**
 * Apply the standard atmospheric lapse rate (-6.5 degC/1000m) to
 * adjust a temperature reported at `stationElevationM` so that it
 * reflects conditions at `queryElevationM`.
 *
 * Positive elevation gain cools the air; negative gain warms it.
 *
 * @example
 *   applyLapseRate(20, 0, 1000)    // 13.5  — ascend 1km, lose 6.5C
 *   applyLapseRate(10, 3000, 0)    // 29.5  — descend 3km, gain 19.5C
 *   applyLapseRate(15, 500, 600)   // 14.35 — small ascent, small loss
 */
export function applyLapseRate(
  temperatureC: number,
  stationElevationM: number,
  queryElevationM: number
): number {
  const deltaM = queryElevationM - stationElevationM;
  return temperatureC - deltaM * LAPSE_RATE_C_PER_M;
}

/**
 * Whether the elevation gap between a station and the queried coordinate
 * is large enough to warrant lapse-rate correction. Below the threshold
 * the correction is within typical model noise and we skip it.
 *
 * @example
 *   shouldApplyCorrection(100, 150)   // false (50m delta)
 *   shouldApplyCorrection(100, 350)   // true  (250m delta)
 */
export function shouldApplyCorrection(
  stationElevationM: number,
  queryElevationM: number
): boolean {
  return Math.abs(queryElevationM - stationElevationM) > ELEVATION_DELTA_THRESHOLD_M;
}

/**
 * Combined helper: look up the true elevation at (lat, lon) and, if it
 * differs from `stationElevationM` by more than the threshold, return a
 * lapse-rate-corrected temperature. Otherwise returns the input unchanged.
 *
 * On any failure (API down, malformed response, network error) this
 * function logs a warning and returns the original temperature so that
 * callers degrade gracefully — elevation correction is a refinement, not
 * a critical-path operation.
 *
 * @example
 *   // Aspen, CO at ~2400m, forecast from a 1900m station reporting 20C:
 *   const corrected = await correctTemperature(20, 39.19, -106.82, 1900);
 *   // corrected approximately 16.75 (delta 500m * 6.5C/1000m = 3.25C cooler)
 */
export async function correctTemperature(
  temperatureC: number,
  lat: number,
  lon: number,
  stationElevationM: number
): Promise<number> {
  let queryElevationM: number;
  try {
    queryElevationM = await getElevation(lat, lon);
  } catch (err) {
    logger.warn(
      { err, lat, lon },
      'Elevation lookup failed, returning original temperature'
    );
    return temperatureC;
  }

  if (!shouldApplyCorrection(stationElevationM, queryElevationM)) {
    return temperatureC;
  }

  return applyLapseRate(temperatureC, stationElevationM, queryElevationM);
}
