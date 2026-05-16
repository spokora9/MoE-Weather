/**
 * Environment and Climate Change Canada (ECCC) Adapter
 * Uses the MSC GeoMet OGC API - free, no API key required
 * https://api.weather.gc.ca/
 */

import {
  WeatherAdapter,
  type AdapterConfig,
  type AdapterResponse,
  fetchWithRetry,
} from './base.js';
import type {
  WeatherRequest,
  CurrentWeather,
  WeatherAlert,
} from '../types/weather.js';
import { WeatherCode } from '../types/weather.js';

// ---------------------------------------------------------------------------
// Raw API response shapes
// ---------------------------------------------------------------------------

interface ECCCFeatureProperties {
  TMP?: number;    // temperature °C
  WSPD?: number;   // wind speed km/h
  WDIR?: number;   // wind direction degrees
  RH?: number;     // relative humidity %
  PRMSL?: number;  // pressure Pa
  [key: string]: unknown;
}

interface ECCCForecastResponse {
  features: Array<{
    properties: ECCCFeatureProperties;
  }>;
}

interface ECCCAlertProperties {
  headline?: string;
  severity?: string;
  event?: string;
  effective?: string;
  expires?: string;
  description?: string;
  urgency?: string;
  [key: string]: unknown;
}

interface ECCCAlertsResponse {
  features: Array<{
    id?: string;
    properties: ECCCAlertProperties;
  }>;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class ECCCCanadaAdapter extends WeatherAdapter {
  constructor(config?: Partial<AdapterConfig>) {
    super('eccc-canada', {
      baseUrl: 'https://api.weather.gc.ca',
      timeout: 15000,
      retries: 3,
      ...config,
    });

    // GeoMet OGC API has no enforced rate limits for reasonable usage
    this.quota = {
      limit: Infinity,
      used: 0,
      resetAt: new Date(),
      type: 'unlimited',
    };
  }

  /**
   * Canada bounding box:
   *   lat  41.7 – 83.1
   *   lon -141.0 – -52.6
   */
  isInCoverageArea(lat: number, lon: number): boolean {
    return lat >= 41.7 && lat <= 83.1 && lon >= -141.0 && lon <= -52.6;
  }

  getProvider() {
    return 'eccc-canada' as const;
  }

  getBaseWeight(): number {
    return 0.30; // Authoritative national source for Canada
  }

  getConditionWeights(): Record<string, number> {
    return {
      temperature: 0.35,
      precipitation: 0.30,
      wind: 0.30,
      humidity: 0.30,
      uvIndex: 0.10,
      alerts: 0.50, // ECCC is the authoritative alert source for Canada
    };
  }

  async fetch(request: WeatherRequest): Promise<AdapterResponse> {
    const startTime = Date.now();
    const { latitude: lat, longitude: lon } = request;

    if (!this.isInCoverageArea(lat, lon)) {
      return {
        raw: {
          provider: 'eccc-canada',
          data: { error: 'Location outside ECCC (Environment Canada) coverage area' },
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        },
      };
    }

    try {
      // Build forecast URL using HRDPS Continental model
      // S_INTERSECTS filter requires the geometry parameter
      const forecastUrl =
        `${this.config.baseUrl}/collections/weather:forecast-model-hrdps-continental/items` +
        `?f=json&limit=1&sortby=-properties.datetime` +
        `&filter=S_INTERSECTS(geometry,POINT(${lon}%20${lat}))`;

      // Bounding box for alerts: ±0.5 degrees around the point
      const alertsUrl =
        `${this.config.baseUrl}/collections/alerts/items` +
        `?f=json&bbox=${lon - 0.5},${lat - 0.5},${lon + 0.5},${lat + 0.5}&limit=10`;

      // Fetch forecast and alerts in parallel; gracefully handle failures in either
      const [forecastResult, alertsResult] = await Promise.allSettled([
        fetchWithRetry(forecastUrl, {}, this.config.retries, this.config.timeout),
        request.includeAlerts !== false
          ? fetchWithRetry(alertsUrl, {}, 2, 8000)
          : Promise.resolve(null),
      ]);

      const responseTime = Date.now() - startTime;
      this.incrementQuota();

      // -----------------------------------------------------------------------
      // Parse forecast
      // -----------------------------------------------------------------------
      let current: CurrentWeather | undefined;
      let rawForecastData: unknown = {};

      if (forecastResult.status === 'fulfilled') {
        try {
          const forecastData = (await forecastResult.value.json()) as ECCCForecastResponse;
          rawForecastData = forecastData;
          current = this.parseCurrentWeather(forecastData);
        } catch {
          // JSON parse failed — continue without current
        }
      }
      // 404 or other HTTP errors are treated as "no data" (graceful)

      // -----------------------------------------------------------------------
      // Parse alerts
      // -----------------------------------------------------------------------
      let alerts: WeatherAlert[] = [];

      if (alertsResult.status === 'fulfilled' && alertsResult.value) {
        try {
          const alertsData = (await alertsResult.value.json()) as ECCCAlertsResponse;
          alerts = this.parseAlerts(alertsData);
        } catch {
          // Alerts parsing failed — continue without alerts
        }
      }

      return {
        current,
        hourly: [],   // HRDPS item endpoint returns single-time features; hourly not mapped here
        daily: [],
        alerts,
        raw: {
          provider: 'eccc-canada',
          data: rawForecastData,
          fetchedAt: new Date(),
          responseTime,
        },
      };
    } catch (error) {
      return {
        raw: {
          provider: 'eccc-canada',
          data: { error: (error as Error).message },
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private parseCurrentWeather(data: ECCCForecastResponse): CurrentWeather | undefined {
    if (!data.features || data.features.length === 0) return undefined;

    const props = data.features[0].properties;

    // TMP is required for a meaningful current weather record
    if (props.TMP === undefined || props.TMP === null) return undefined;

    return {
      temperature: props.TMP,
      feelsLike: props.TMP,                              // ECCC doesn't expose apparent temp here
      humidity: props.RH ?? 0,
      pressure: props.PRMSL !== undefined ? props.PRMSL / 100 : 0, // Pa → hPa
      windSpeed: props.WSPD !== undefined ? props.WSPD / 3.6 : 0,  // km/h → m/s
      windDirection: props.WDIR ?? 0,
      windGust: undefined,
      visibility: 10000,   // Not available from this endpoint
      uvIndex: undefined,
      cloudCover: 0,       // Not available from this endpoint
      precipitation: undefined,
      weatherCode: WeatherCode.UNKNOWN,
      weatherDescription: 'Environment Canada forecast',
      timestamp: new Date(),
    };
  }

  private parseAlerts(data: ECCCAlertsResponse): WeatherAlert[] {
    if (!data.features || data.features.length === 0) return [];

    const severityMap: Record<string, WeatherAlert['severity']> = {
      minor: 'minor',
      Minor: 'minor',
      moderate: 'moderate',
      Moderate: 'moderate',
      severe: 'severe',
      Severe: 'severe',
      extreme: 'extreme',
      Extreme: 'extreme',
    };

    const urgencyMap: Record<string, WeatherAlert['urgency']> = {
      Immediate: 'immediate',
      immediate: 'immediate',
      Expected: 'expected',
      expected: 'expected',
      Future: 'future',
      future: 'future',
      Past: 'past',
      past: 'past',
    };

    return data.features.map((feature, idx) => {
      const p = feature.properties;
      return {
        id: feature.id?.toString() ?? `eccc-alert-${idx}`,
        event: p.event ?? 'WEATHER ALERT',
        headline: p.headline ?? p.event ?? 'Environment Canada Alert',
        description: p.description ?? p.headline ?? '',
        severity: severityMap[p.severity ?? ''] ?? 'moderate',
        urgency: urgencyMap[p.urgency ?? ''] ?? 'unknown',
        start: new Date(p.effective ?? Date.now()),
        end: new Date(p.expires ?? Date.now()),
        source: 'ECCC',
      };
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Use a lightweight metadata check — just hit the collection landing page
      const response = await fetchWithRetry(
        `${this.config.baseUrl}/collections/alerts?f=json`,
        {},
        1,
        5000
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
