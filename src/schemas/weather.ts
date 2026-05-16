import { z } from 'zod';

export const CoordinateSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export const WeatherRequestSchema = CoordinateSchema.extend({
  units: z.enum(['metric', 'imperial']).default('metric'),
  hourly: z.coerce.number().int().min(1).max(168).default(48),
  daily: z.coerce.number().int().min(1).max(14).default(7),
  alerts: z.coerce.boolean().default(true),
});

/**
 * BCP-47 language tag (subset supported by Open-Meteo geocoding):
 *   - 2-letter language code (e.g. "en", "de", "fr")
 *   - Optionally followed by a 2-letter region code (e.g. "en-US", "pt-BR")
 * Open-Meteo supported languages: en, de, fr, es, it, pt, ru, ja, zh
 */
export const LanguageCodeSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid language code (expected BCP47 like "en" or "en-US")');

export const GeocodeRequestSchema = z.object({
  q: z.string().min(2).max(100).transform(s => s.normalize('NFC').trim()),
  lang: LanguageCodeSchema.optional(),
});

export const AirQualityRequestSchema = CoordinateSchema;
export const MarineRequestSchema = CoordinateSchema;
export const AstronomyRequestSchema = CoordinateSchema;
export const HistoricalRequestSchema = CoordinateSchema.extend({
  days: z.coerce.number().int().min(7).max(30).default(10),
});
