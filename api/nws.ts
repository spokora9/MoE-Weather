/**
 * Vercel Serverless Function - National Weather Service API
 * Free, no API key required - Official US Government weather data
 * https://www.weather.gov/documentation/services-web-api
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

const nwsQuerySchema = z.object({
  lat: z.coerce.number().min(24).max(50), // Continental US latitude range
  lon: z.coerce.number().min(-125).max(-66), // Continental US longitude range
});

interface NWSPoint {
  properties: {
    gridId: string;
    gridX: number;
    gridY: number;
    forecast: string;
    forecastHourly: string;
    forecastGridData: string;
    observationStations: string;
    relativeLocation: {
      properties: {
        city: string;
        state: string;
      };
    };
  };
}

interface NWSForecast {
  properties: {
    updated: string;
    periods: Array<{
      number: number;
      name: string;
      startTime: string;
      endTime: string;
      isDaytime: boolean;
      temperature: number;
      temperatureUnit: string;
      temperatureTrend: string | null;
      windSpeed: string;
      windDirection: string;
      icon: string;
      shortForecast: string;
      detailedForecast: string;
      probabilityOfPrecipitation?: {
        value: number | null;
      };
      relativeHumidity?: {
        value: number | null;
      };
    }>;
  };
}

interface NWSAlerts {
  features: Array<{
    properties: {
      id: string;
      areaDesc: string;
      headline: string;
      severity: string;
      urgency: string;
      event: string;
      description: string;
      instruction: string;
      effective: string;
      expires: string;
    };
  }>;
}

// NWS API requires a User-Agent header
const NWS_HEADERS = {
  'User-Agent': '(MoE-Weather, contact@example.com)',
  'Accept': 'application/geo+json',
};

async function fetchNWS(url: string): Promise<any> {
  const response = await fetch(url, { headers: NWS_HEADERS });
  if (!response.ok) {
    throw new Error(`NWS API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
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
    const query = nwsQuerySchema.parse(req.query);
    const { lat, lon } = query;

    // Step 1: Get grid point for the location
    const pointUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
    const pointData: NWSPoint = await fetchNWS(pointUrl);

    const { gridId, gridX, gridY, forecast, forecastHourly, relativeLocation } = pointData.properties;
    const location = relativeLocation?.properties || { city: 'Unknown', state: '' };

    // Step 2: Fetch forecast, hourly forecast, and alerts in parallel
    const [forecastData, hourlyData, alertsData] = await Promise.all([
      fetchNWS(forecast) as Promise<NWSForecast>,
      fetchNWS(forecastHourly) as Promise<NWSForecast>,
      fetchNWS(`https://api.weather.gov/alerts/active?point=${lat},${lon}`) as Promise<NWSAlerts>,
    ]);

    // Parse the forecast periods
    const dailyPeriods = forecastData.properties.periods;
    const hourlyPeriods = hourlyData.properties.periods;

    // Get current conditions from the first hourly period
    const currentHour = hourlyPeriods[0];
    const windMatch = currentHour.windSpeed.match(/(\d+)/);
    const windSpeed = windMatch ? parseInt(windMatch[1]) : 0;

    // Parse alerts
    const alerts = alertsData.features.map(alert => ({
      id: alert.properties.id,
      event: alert.properties.event,
      headline: alert.properties.headline,
      severity: alert.properties.severity,
      urgency: alert.properties.urgency,
      description: alert.properties.description,
      instruction: alert.properties.instruction,
      effective: alert.properties.effective,
      expires: alert.properties.expires,
      areaDesc: alert.properties.areaDesc,
    }));

    // Build response
    const response = {
      source: 'National Weather Service',
      location: {
        city: location.city,
        state: location.state,
        gridId,
        gridX,
        gridY,
      },
      current: {
        temperature: currentHour.temperature,
        temperatureUnit: currentHour.temperatureUnit,
        windSpeed: windSpeed,
        windDirection: currentHour.windDirection,
        shortForecast: currentHour.shortForecast,
        detailedForecast: currentHour.detailedForecast,
        icon: currentHour.icon,
        humidity: currentHour.relativeHumidity?.value || null,
        precipitationChance: currentHour.probabilityOfPrecipitation?.value || 0,
        isDaytime: currentHour.isDaytime,
      },
      hourly: hourlyPeriods.slice(0, 24).map(period => ({
        time: period.startTime,
        temperature: period.temperature,
        temperatureUnit: period.temperatureUnit,
        windSpeed: period.windSpeed,
        windDirection: period.windDirection,
        shortForecast: period.shortForecast,
        icon: period.icon,
        precipitationChance: period.probabilityOfPrecipitation?.value || 0,
        humidity: period.relativeHumidity?.value || null,
        isDaytime: period.isDaytime,
      })),
      daily: dailyPeriods.map(period => ({
        name: period.name,
        startTime: period.startTime,
        endTime: period.endTime,
        temperature: period.temperature,
        temperatureUnit: period.temperatureUnit,
        windSpeed: period.windSpeed,
        windDirection: period.windDirection,
        shortForecast: period.shortForecast,
        detailedForecast: period.detailedForecast,
        icon: period.icon,
        precipitationChance: period.probabilityOfPrecipitation?.value || 0,
        isDaytime: period.isDaytime,
      })),
      alerts: alerts,
      metadata: {
        updated: forecastData.properties.updated,
        source: 'National Weather Service (weather.gov)',
        gridPoint: `${gridId}/${gridX},${gridY}`,
      },
    };

    // Cache for 15 minutes (NWS updates hourly)
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid coordinates - NWS API only covers US locations',
        details: error.errors,
      });
    }

    console.error('[API] NWS error:', error);
    return res.status(500).json({
      error: 'Failed to fetch NWS weather data',
      message: (error as Error).message,
    });
  }
}
