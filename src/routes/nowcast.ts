/**
 * Nowcast route — minute-by-minute precipitation forecast for the next 60
 * minutes, sourced from Tomorrow.io.
 *
 * GET /api/nowcast?lat=&lon=
 *
 * Access policy:
 *   - Pro tier only. Free / anonymous users receive 402 Payment Required with
 *     an upgradeUrl in the body so the client can prompt for upgrade.
 *
 * Caching:
 *   - Results are cached for 5 minutes per coordinate pair (rounded to two
 *     decimal places, ~1.1 km) using an internal Map-based store. This
 *     intentionally lives inside the factory so the router can be tested in
 *     isolation without sharing state with the orchestrator's CacheManager.
 *
 * Failure modes:
 *   - 400  invalid lat / lon
 *   - 402  caller is not on the Pro tier
 *   - 503  Tomorrow.io API key not configured OR upstream returned nothing
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { CoordinateSchema } from '../schemas/weather.js';
import { createLogger } from '../lib/logger.js';
import { optionalAuth } from '../middleware/auth.js';
import { getUserTier } from '../lib/tier.js';
import { TomorrowIOAdapter, type NowcastEntry } from '../adapters/tomorrow-io.js';
import type { WeatherOrchestrator } from '../engine/orchestrator.js';

const logger = createLogger('routes:nowcast').child({ component: 'routes:nowcast' });

// 5 minutes — matches orchestrator's "current" cache TTL.
const CACHE_TTL_MS = 5 * 60 * 1000;

interface NowcastResponseBody {
  location: { lat: number; lon: number };
  nowcast: NowcastEntry[];
  unit: 'mm/h';
  fetchedAt: string;
}

interface CacheEntry {
  expiresAt: number;
  body: NowcastResponseBody;
}

/**
 * 402-returning tier gate. The shared `requiresTier` helper in lib/tier.ts
 * answers with 403, which is the right code for "forbidden, can never have
 * access". For paid features the more accurate code is 402 Payment Required,
 * so the nowcast route uses this local variant instead of `requiresTier`.
 */
function requirePaidTier(req: Request, res: Response, next: NextFunction): void {
  const tier = getUserTier(req);
  if (tier === 'pro') {
    next();
    return;
  }
  logger.warn({ tier }, 'Nowcast access denied — payment required');
  res.status(402).json({
    error: 'upgrade_required',
    message: 'Minute-by-minute nowcast requires a Pro subscription',
    upgradeUrl: '/api/subscription/upgrade',
  });
}

/**
 * Round coordinates to ~1.1 km grid (2 decimal places) for cache key locality.
 */
function cacheKey(lat: number, lon: number): string {
  const rl = Math.round(lat * 100) / 100;
  const rn = Math.round(lon * 100) / 100;
  return `${rl}:${rn}`;
}

/**
 * Build the nowcast router.
 *
 * @param _orchestrator  Currently unused; kept in the signature so the router
 *                       can later read cached state from the shared cache
 *                       manager once the orchestrator exposes it publicly.
 *                       The orchestrator does not (yet) register a
 *                       TomorrowIOAdapter in its adapters Map, so this factory
 *                       constructs its own using TOMORROW_IO_API_KEY.
 * @param adapterOverride  Optional adapter instance for tests so they don't
 *                         have to set environment variables.
 */
export function createNowcastRouter(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orchestrator: WeatherOrchestrator,
  adapterOverride?: TomorrowIOAdapter
): Router {
  const router = Router();
  const adapter = adapterOverride ?? new TomorrowIOAdapter();
  const cache = new Map<string, CacheEntry>();

  router.get(
    '/',
    optionalAuth,
    requirePaidTier,
    async (req: Request, res: Response) => {
      // ─── Validate coords ─────────────────────────────────────────────────
      const parsed = CoordinateSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: parsed.error.errors,
        });
        return;
      }
      const { lat, lon } = parsed.data;

      // ─── Refuse if Tomorrow.io is not configured ─────────────────────────
      // hasQuota() returns false when no API key was supplied (limit = 0).
      if (!adapter.hasQuota()) {
        logger.warn({ lat, lon }, 'Tomorrow.io adapter unavailable (no API key or quota exhausted)');
        res.status(503).json({
          error: 'service_unavailable',
          message: 'Nowcast provider is not configured',
        });
        return;
      }

      // ─── Cache lookup ────────────────────────────────────────────────────
      const key = cacheKey(lat, lon);
      const now = Date.now();
      const hit = cache.get(key);
      if (hit && hit.expiresAt > now) {
        logger.debug({ lat, lon }, 'Nowcast cache hit');
        res.json(hit.body);
        return;
      }

      // ─── Upstream fetch ──────────────────────────────────────────────────
      let entries: NowcastEntry[];
      try {
        entries = await adapter.getNowcast(lat, lon);
      } catch (err) {
        logger.error({ err, lat, lon }, 'Tomorrow.io nowcast fetch threw');
        res.status(503).json({
          error: 'service_unavailable',
          message: 'Upstream nowcast provider failed',
        });
        return;
      }

      if (!entries || entries.length === 0) {
        // Adapter swallows errors and returns []. We can't distinguish "no
        // precip" from "API down" cleanly, so we treat empty as upstream
        // failure — Tomorrow.io always returns minutely entries for valid
        // coordinates when healthy.
        logger.warn({ lat, lon }, 'Tomorrow.io returned empty nowcast');
        res.status(503).json({
          error: 'service_unavailable',
          message: 'No nowcast data available from upstream',
        });
        return;
      }

      const body: NowcastResponseBody = {
        location: { lat, lon },
        nowcast: entries,
        unit: 'mm/h',
        fetchedAt: new Date().toISOString(),
      };

      cache.set(key, { expiresAt: now + CACHE_TTL_MS, body });
      logger.info({ lat, lon, count: entries.length }, 'Nowcast served');
      res.json(body);
    }
  );

  // Catch-all error guard for unexpected sync throws inside the handler.
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request parameters', details: err.errors });
      return;
    }
    logger.error({ err }, 'Nowcast route error');
    res.status(500).json({ error: 'Internal server error' });
  });

  return router;
}
