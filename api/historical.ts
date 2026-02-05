/**
 * Vercel Serverless Function - Historical Weather API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  days: z.coerce.number().min(7).max(90).optional().default(30),
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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
    const query = querySchema.parse(req.query);

    // Calculate date range (past N days)
    // Note: Archive API has ~5 day delay, so end 7 days ago to ensure data availability
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 7);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - query.days - 7);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const params = new URLSearchParams({
      latitude: query.lat.toString(),
      longitude: query.lon.toString(),
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'temperature_2m_mean',
        'precipitation_sum',
        'rain_sum',
        'snowfall_sum',
        'precipitation_hours',
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'wind_direction_10m_dominant',
      ].join(','),
      hourly: [
        'relative_humidity_2m',
        'pressure_msl',
        'cloud_cover',
      ].join(','),
      timezone: 'auto',
    });

    const response = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?${params}`
    );

    if (!response.ok) {
      throw new Error(`Historical API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      daily?: {
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        temperature_2m_mean?: number[];
        precipitation_sum?: number[];
        wind_speed_10m_max?: number[];
      };
      hourly?: {
        relative_humidity_2m?: number[];
        pressure_msl?: number[];
        cloud_cover?: number[];
      };
    };

    // Calculate averages
    const calcAvg = (arr?: number[]) => {
      if (!arr || arr.length === 0) return null;
      const valid = arr.filter(v => v !== null && v !== undefined);
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };

    const averages = {
      period_days: query.days,
      temperature: {
        avg_high: calcAvg(data.daily?.temperature_2m_max),
        avg_low: calcAvg(data.daily?.temperature_2m_min),
        avg_mean: calcAvg(data.daily?.temperature_2m_mean),
      },
      humidity: {
        avg: calcAvg(data.hourly?.relative_humidity_2m),
      },
      pressure: {
        avg: calcAvg(data.hourly?.pressure_msl),
      },
      wind: {
        avg_max: calcAvg(data.daily?.wind_speed_10m_max),
      },
      precipitation: {
        avg_daily: calcAvg(data.daily?.precipitation_sum),
      },
      cloud_cover: {
        avg: calcAvg(data.hourly?.cloud_cover),
      },
    };

    return res.status(200).json(averages);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    }

    console.error('[API] Historical error:', error);
    return res.status(500).json({
      error: 'Failed to fetch historical data',
      message: (error as Error).message,
    });
  }
}
