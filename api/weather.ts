/**
 * Vercel Serverless Function - Weather API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { WeatherOrchestrator } from '../dist/engine/orchestrator.js';
import type { WeatherRequest } from '../dist/types/weather.js';

const weatherQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  units: z.enum(['metric', 'imperial']).optional().default('metric'),
  hourly: z.coerce.number().min(1).max(168).optional().default(48),
  daily: z.coerce.number().min(1).max(14).optional().default(7),
  alerts: z.coerce.boolean().optional().default(true),
});

// Initialize orchestrator (cached between invocations)
let orchestrator: WeatherOrchestrator | null = null;

function getOrchestrator(): WeatherOrchestrator {
  if (!orchestrator) {
    orchestrator = new WeatherOrchestrator({
      apiKeys: {
        openWeatherMap: process.env.OPENWEATHERMAP_API_KEY,
        weatherApi: process.env.WEATHERAPI_KEY,
        tomorrowIo: process.env.TOMORROW_IO_API_KEY,
      },
    });
  }
  return orchestrator;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const query = weatherQuerySchema.parse(req.query);

    const request: WeatherRequest = {
      latitude: query.lat,
      longitude: query.lon,
      units: query.units,
      hourlyHours: query.hourly,
      dailyDays: query.daily,
      includeAlerts: query.alerts,
    };

    const weather = await getOrchestrator().getWeather(request);

    // Convert units if needed
    if (query.units === 'imperial') {
      convertToImperial(weather);
    }

    return res.status(200).json(weather);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    }

    console.error('[API] Weather error:', error);
    return res.status(500).json({
      error: 'Failed to fetch weather data',
      message: (error as Error).message,
    });
  }
}

function convertToImperial(weather: Awaited<ReturnType<WeatherOrchestrator['getWeather']>>): void {
  if (weather.current) {
    weather.current.temperature = celsiusToFahrenheit(weather.current.temperature);
    weather.current.feelsLike = celsiusToFahrenheit(weather.current.feelsLike);
    weather.current.windSpeed = msToMph(weather.current.windSpeed);
    if (weather.current.windGust) {
      weather.current.windGust = msToMph(weather.current.windGust);
    }
    weather.current.visibility = metersToMiles(weather.current.visibility);
  }

  for (const hour of weather.hourly) {
    hour.temperature = celsiusToFahrenheit(hour.temperature);
    hour.feelsLike = celsiusToFahrenheit(hour.feelsLike);
    hour.windSpeed = msToMph(hour.windSpeed);
    hour.precipitation = mmToInches(hour.precipitation);
  }

  for (const day of weather.daily) {
    day.temperatureMax = celsiusToFahrenheit(day.temperatureMax);
    day.temperatureMin = celsiusToFahrenheit(day.temperatureMin);
    day.windSpeed = msToMph(day.windSpeed);
    day.precipitation = mmToInches(day.precipitation);
  }
}

function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9/5 + 32) * 10) / 10;
}

function msToMph(ms: number): number {
  return Math.round(ms * 2.237 * 10) / 10;
}

function metersToMiles(m: number): number {
  return Math.round(m / 1609.34 * 10) / 10;
}

function mmToInches(mm: number): number {
  return Math.round(mm / 25.4 * 100) / 100;
}
