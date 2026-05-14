/**
 * Vercel Serverless Function - Health Check API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { WeatherOrchestrator } from '../dist/engine/orchestrator.js';

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
    const orch = getOrchestrator();
    const healthStatus = await orch.runHealthChecks();
    const cacheStats = orch.getCacheStats();

    const providers = Array.from(healthStatus.entries()).map(
      ([name, healthy]) => ({ name, healthy })
    );

    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      providers,
      cache: cacheStats,
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: (error as Error).message,
    });
  }
}
