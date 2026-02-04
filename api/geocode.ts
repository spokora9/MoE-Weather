/**
 * Vercel Serverless Function - Geocoding API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { WeatherOrchestrator } from '../src/engine/orchestrator';

const geocodeQuerySchema = z.object({
  q: z.string().min(2).max(100),
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
    const query = geocodeQuerySchema.parse(req.query);
    const results = await getOrchestrator().geocode(query.q);
    return res.status(200).json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    }

    console.error('[API] Geocode error:', error);
    return res.status(500).json({
      error: 'Failed to geocode location',
      message: (error as Error).message,
    });
  }
}
