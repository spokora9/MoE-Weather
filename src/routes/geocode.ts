/**
 * Geocoding route.
 *
 * GET /api/geocode?q=<query>&lang=<bcp47>
 *
 * Language resolution order:
 *   1. `lang` query parameter (Zod-validated against BCP-47 subset).
 *   2. The first language tag in the request's `Accept-Language` header.
 *   3. Fallback to "en".
 *
 * The orchestrator forwards the resolved language to Open-Meteo's geocoding
 * API and uses it as part of the cache key so results in different languages
 * don't collide (e.g. "Köln" vs "Cologne").
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { GeocodeRequestSchema, LanguageCodeSchema } from '../schemas/weather.js';
import { createLogger } from '../lib/logger.js';
import type { WeatherOrchestrator } from '../engine/orchestrator.js';

const logger = createLogger('routes:geocode');
const routeLogger = logger.child({ component: 'routes:geocode' });

/**
 * Parse the first language tag from an Accept-Language header.
 *
 * Examples:
 *   "de-DE,de;q=0.9,en;q=0.8" → "de-DE"
 *   "fr"                       → "fr"
 *   ""                         → null
 *
 * Returns null if the header is missing, empty, or the first tag doesn't
 * match the BCP-47 subset we support.
 */
export function parseAcceptLanguage(header: string | undefined): string | null {
  if (!header) return null;
  const first = header.split(',')[0]?.split(';')[0]?.trim();
  if (!first) return null;
  // Normalize casing: language lower, region upper.
  const parts = first.split('-');
  const lang = parts[0]?.toLowerCase();
  const region = parts[1]?.toUpperCase();
  const candidate = region ? `${lang}-${region}` : lang;
  if (!candidate) return null;
  const result = LanguageCodeSchema.safeParse(candidate);
  return result.success ? candidate : null;
}

export function createGeocodeRouter(orchestrator: Pick<WeatherOrchestrator, 'geocode'>): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const parsed = GeocodeRequestSchema.parse(req.query);

      // Resolve language: query param > Accept-Language header > "en".
      const headerLang = parseAcceptLanguage(req.header('accept-language') ?? undefined);
      const lang = parsed.lang ?? headerLang ?? 'en';

      const results = await orchestrator.geocode(parsed.q, lang);
      res.json(results);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors,
        });
        return;
      }
      routeLogger.error({ err: error }, 'Geocode endpoint error');
      res.status(500).json({
        error: 'Failed to geocode location',
        message: (error as Error).message,
      });
    }
  });

  return router;
}
