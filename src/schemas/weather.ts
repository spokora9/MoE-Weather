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

export const GeocodeRequestSchema = z.object({
  q: z.string().min(2).max(100).transform(s => s.normalize('NFC').trim()),
  lang: z.string().length(2).default('en').optional(),
});

export const AirQualityRequestSchema = CoordinateSchema;
export const MarineRequestSchema = CoordinateSchema;
export const AstronomyRequestSchema = CoordinateSchema;
export const HistoricalRequestSchema = CoordinateSchema.extend({
  days: z.coerce.number().int().min(7).max(30).default(10),
});
