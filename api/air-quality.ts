/**
 * Vercel Serverless Function - Air Quality API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

function getAqiLabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

function getAqiColor(aqi: number): string {
  if (aqi <= 50) return '#00e400';
  if (aqi <= 100) return '#ffff00';
  if (aqi <= 150) return '#ff7e00';
  if (aqi <= 200) return '#ff0000';
  if (aqi <= 300) return '#8f3f97';
  return '#7e0023';
}

function getHealthRecommendation(aqi: number): string {
  if (aqi <= 50) return 'Air quality is good. Enjoy outdoor activities!';
  if (aqi <= 100) return 'Acceptable air quality. Unusually sensitive people should limit prolonged outdoor exertion.';
  if (aqi <= 150) return 'Sensitive groups should reduce prolonged outdoor exertion.';
  if (aqi <= 200) return 'Everyone should reduce prolonged outdoor exertion.';
  if (aqi <= 300) return 'Everyone should avoid prolonged outdoor exertion.';
  return 'Health alert! Everyone should avoid all outdoor activities.';
}

function getPollenRisk(current: Record<string, number>): { level: string; types: string[] } {
  const pollenTypes: string[] = [];
  let maxPollen = 0;

  const pollenFields = [
    { key: 'alder_pollen', name: 'Alder' },
    { key: 'birch_pollen', name: 'Birch' },
    { key: 'grass_pollen', name: 'Grass' },
    { key: 'mugwort_pollen', name: 'Mugwort' },
    { key: 'olive_pollen', name: 'Olive' },
    { key: 'ragweed_pollen', name: 'Ragweed' },
  ];

  for (const { key, name } of pollenFields) {
    const value = current[key];
    if (value && value > 10) {
      pollenTypes.push(name);
      maxPollen = Math.max(maxPollen, value);
    }
  }

  let level = 'Low';
  if (maxPollen > 100) level = 'Very High';
  else if (maxPollen > 50) level = 'High';
  else if (maxPollen > 20) level = 'Moderate';

  return { level, types: pollenTypes };
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
        'us_aqi',
        'pm10',
        'pm2_5',
        'carbon_monoxide',
        'nitrogen_dioxide',
        'sulphur_dioxide',
        'ozone',
        'dust',
        'uv_index',
        'alder_pollen',
        'birch_pollen',
        'grass_pollen',
        'mugwort_pollen',
        'olive_pollen',
        'ragweed_pollen',
      ].join(','),
      timezone: 'auto',
    });

    const response = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`
    );

    if (!response.ok) {
      throw new Error(`Air Quality API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      current?: Record<string, number>;
      [key: string]: unknown;
    };

    // Add interpretations
    if (data.current) {
      const aqi = data.current.us_aqi || 0;
      const enhanced = {
        ...data,
        current: {
          ...data.current,
          us_aqi_label: getAqiLabel(aqi),
          us_aqi_color: getAqiColor(aqi),
          health_recommendation: getHealthRecommendation(aqi),
          pollen_risk: getPollenRisk(data.current),
        },
      };
      return res.status(200).json(enhanced);
    }

    return res.status(200).json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    }

    console.error('[API] Air Quality error:', error);
    return res.status(500).json({
      error: 'Failed to fetch air quality data',
      message: (error as Error).message,
    });
  }
}
