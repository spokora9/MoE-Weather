/**
 * Vercel Serverless Function - Marine/Ocean API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

function getSurfConditions(waveHeight: number, wavePeriod: number, swellHeight: number): {
  rating: string;
  description: string;
  suitable_for: string[];
} {
  const totalWave = (waveHeight || 0) + (swellHeight || 0) * 0.5;

  if (totalWave < 0.3) {
    return {
      rating: 'Flat',
      description: 'Very calm waters, minimal wave activity',
      suitable_for: ['Swimming', 'Paddleboarding', 'Kayaking'],
    };
  } else if (totalWave < 1.0) {
    return {
      rating: 'Small',
      description: 'Light waves, good for beginners',
      suitable_for: ['Beginner surfing', 'Bodyboarding', 'Swimming'],
    };
  } else if (totalWave < 2.0) {
    return {
      rating: 'Medium',
      description: 'Moderate waves, fun conditions',
      suitable_for: ['Intermediate surfing', 'Bodyboarding'],
    };
  } else if (totalWave < 3.5) {
    return {
      rating: 'Large',
      description: 'Significant waves, experienced surfers only',
      suitable_for: ['Advanced surfing', 'Experienced swimmers'],
    };
  } else {
    return {
      rating: 'Very Large',
      description: 'Dangerous conditions, stay out of water',
      suitable_for: ['Expert surfers only', 'Shore watching'],
    };
  }
}

function calculateTides(longitude: number): {
  high_tides: { time: string; height: string }[];
  low_tides: { time: string; height: string }[];
  note: string;
} {
  const now = new Date();

  // Calculate lunar transit time (simplified)
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const lunarDayOffset = (dayOfYear * 50) % (24 * 60);

  // Adjust for longitude (4 minutes per degree)
  const longitudeOffset = longitude * 4;

  // High tide occurs roughly when moon is overhead or opposite
  const baseHighTide = (lunarDayOffset + longitudeOffset + 720) % (24 * 60);

  // Calculate 4 tides (2 high, 2 low) - roughly 6h 12m apart
  const tideInterval = 6 * 60 + 12;

  const localOffset = now.getTimezoneOffset();
  const highTide1 = (baseHighTide - localOffset + 24 * 60) % (24 * 60);
  const highTide2 = (highTide1 + 2 * tideInterval) % (24 * 60);
  const lowTide1 = (highTide1 + tideInterval) % (24 * 60);
  const lowTide2 = (lowTide1 + 2 * tideInterval) % (24 * 60);

  const formatTideTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const allHighs = [highTide1, highTide2].sort((a, b) => a - b);
  const allLows = [lowTide1, lowTide2].sort((a, b) => a - b);

  return {
    high_tides: allHighs.map(t => ({
      time: formatTideTime(t),
      height: 'Est.',
    })),
    low_tides: allLows.map(t => ({
      time: formatTideTime(t),
      height: 'Est.',
    })),
    note: 'Estimated from lunar position. Check local tide tables for accuracy.',
  };
}

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

    const params = new URLSearchParams({
      latitude: query.lat.toString(),
      longitude: query.lon.toString(),
      current: [
        'wave_height',
        'wave_direction',
        'wave_period',
        'wind_wave_height',
        'wind_wave_direction',
        'wind_wave_period',
        'swell_wave_height',
        'swell_wave_direction',
        'swell_wave_period',
      ].join(','),
      hourly: [
        'wave_height',
        'wave_direction',
        'wave_period',
        'swell_wave_height',
        'swell_wave_period',
      ].join(','),
      forecast_days: '7',
      timezone: 'auto',
    });

    const response = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?${params}`
    );

    if (!response.ok) {
      throw new Error(`Marine API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      current?: Record<string, number>;
      hourly?: Record<string, number[]>;
    };

    // Add surf conditions assessment
    const surfConditions = data.current ? getSurfConditions(
      data.current.wave_height as number,
      data.current.wave_period as number,
      data.current.swell_wave_height as number
    ) : null;

    // Calculate estimated tides
    const tides = calculateTides(query.lon);

    return res.status(200).json({
      ...data,
      conditions: surfConditions,
      tides,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    }

    console.error('[API] Marine error:', error);
    return res.status(500).json({
      error: 'Failed to fetch marine data',
      message: (error as Error).message,
    });
  }
}
