/**
 * Vercel Serverless Function - Astronomy API (Sun/Moon)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

// Moon phase calculation - using reference new moon method for accuracy
function getMoonPhase(date: Date): {
  phase: string;
  illumination: number;
  emoji: string;
  zodiac: { sign: string; emoji: string };
} {
  // Reference new moon: January 11, 2024 at 11:57 UTC
  const referenceNewMoon = new Date('2024-01-11T11:57:00Z');
  const lunarCycle = 29.53059; // days

  // Calculate days since reference new moon
  const daysSinceReference = (date.getTime() - referenceNewMoon.getTime()) / (1000 * 60 * 60 * 24);

  // Get current position in lunar cycle (0 to 29.53)
  const cyclePosition = ((daysSinceReference % lunarCycle) + lunarCycle) % lunarCycle;

  let phaseName: string;
  let emoji: string;
  let illumination: number;

  // Determine phase based on position in cycle
  if (cyclePosition < 1.85) {
    phaseName = 'New Moon';
    emoji = '🌑';
    illumination = Math.round((1 - Math.cos(cyclePosition / lunarCycle * 2 * Math.PI)) / 2 * 100);
  } else if (cyclePosition < 7.38) {
    phaseName = 'Waxing Crescent';
    emoji = '🌒';
    illumination = Math.round((1 - Math.cos(cyclePosition / lunarCycle * 2 * Math.PI)) / 2 * 100);
  } else if (cyclePosition < 9.23) {
    phaseName = 'First Quarter';
    emoji = '🌓';
    illumination = 50;
  } else if (cyclePosition < 14.77) {
    phaseName = 'Waxing Gibbous';
    emoji = '🌔';
    illumination = Math.round((1 - Math.cos(cyclePosition / lunarCycle * 2 * Math.PI)) / 2 * 100);
  } else if (cyclePosition < 16.61) {
    phaseName = 'Full Moon';
    emoji = '🌕';
    illumination = 100;
  } else if (cyclePosition < 22.15) {
    phaseName = 'Waning Gibbous';
    emoji = '🌖';
    illumination = Math.round((1 - Math.cos(cyclePosition / lunarCycle * 2 * Math.PI)) / 2 * 100);
  } else if (cyclePosition < 23.99) {
    phaseName = 'Last Quarter';
    emoji = '🌗';
    illumination = 50;
  } else if (cyclePosition < 27.68) {
    phaseName = 'Waning Crescent';
    emoji = '🌘';
    illumination = Math.round((1 - Math.cos(cyclePosition / lunarCycle * 2 * Math.PI)) / 2 * 100);
  } else {
    phaseName = 'New Moon';
    emoji = '🌑';
    illumination = Math.round((1 - Math.cos(cyclePosition / lunarCycle * 2 * Math.PI)) / 2 * 100);
  }

  const zodiac = getMoonZodiac(date);

  return { phase: phaseName, illumination, emoji, zodiac };
}

function getMoonZodiac(date: Date): { sign: string; emoji: string } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  let a = Math.floor((14 - month) / 12);
  let y = year - a;
  let m = month + 12 * a - 2;
  let jd = day + Math.floor((31 * m) / 12) + y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + 1721119;

  const moonLongitude = (jd * 13.176396 + 64.975464) % 360;
  const signIndex = Math.floor(moonLongitude / 30);

  const signs = [
    { sign: 'Aries', emoji: '♈' },
    { sign: 'Taurus', emoji: '♉' },
    { sign: 'Gemini', emoji: '♊' },
    { sign: 'Cancer', emoji: '♋' },
    { sign: 'Leo', emoji: '♌' },
    { sign: 'Virgo', emoji: '♍' },
    { sign: 'Libra', emoji: '♎' },
    { sign: 'Scorpio', emoji: '♏' },
    { sign: 'Sagittarius', emoji: '♐' },
    { sign: 'Capricorn', emoji: '♑' },
    { sign: 'Aquarius', emoji: '♒' },
    { sign: 'Pisces', emoji: '♓' },
  ];

  return signs[signIndex] || signs[0];
}

function addMinutes(isoString: string, minutes: number): string {
  const date = new Date(isoString);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function calculateDaylightTrend(daylightDurations?: number[]): string | null {
  if (!daylightDurations || daylightDurations.length < 2) return null;

  const today = daylightDurations[0];
  const yesterday = daylightDurations[1] || today;
  const diff = today - yesterday;

  if (Math.abs(diff) < 30) {
    return 'Daylight steady';
  } else if (diff > 0) {
    const mins = Math.round(diff / 60);
    return `${mins}min more daylight than yesterday`;
  } else {
    const mins = Math.round(Math.abs(diff) / 60);
    return `${mins}min less daylight than yesterday`;
  }
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
      daily: [
        'sunrise',
        'sunset',
        'daylight_duration',
        'sunshine_duration',
        'uv_index_max',
      ].join(','),
      timezone: 'auto',
      forecast_days: '7',
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`
    );

    if (!response.ok) {
      throw new Error(`Astronomy API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      daily?: {
        time?: string[];
        sunrise?: string[];
        sunset?: string[];
        daylight_duration?: number[];
        sunshine_duration?: number[];
        uv_index_max?: number[];
      };
    };

    // Calculate moon phase
    const moonPhase = getMoonPhase(new Date());

    // Calculate golden hour times
    const today = data.daily;
    const goldenHour = today?.sunrise?.[0] && today?.sunset?.[0] ? {
      morning: {
        start: today.sunrise[0],
        end: addMinutes(today.sunrise[0], 60),
      },
      evening: {
        start: addMinutes(today.sunset[0], -60),
        end: today.sunset[0],
      },
    } : null;

    return res.status(200).json({
      daily: data.daily,
      moon: moonPhase,
      golden_hour: goldenHour,
      daylight_trend: calculateDaylightTrend(data.daily?.daylight_duration),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    }

    console.error('[API] Astronomy error:', error);
    return res.status(500).json({
      error: 'Failed to fetch astronomy data',
      message: (error as Error).message,
    });
  }
}
