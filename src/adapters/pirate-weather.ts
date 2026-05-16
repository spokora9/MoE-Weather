/**
 * Pirate Weather API Adapter
 * DarkSky-compatible API. Monthly quota: 10,000 calls → ~333/day.
 * https://pirateweather.net/
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
  HourlyForecast,
  DailyForecast,
  WeatherAlert,
  WeatherCode,
} from '../types/weather.js';

// ---------------------------------------------------------------------------
// DarkSky / Pirate Weather response shapes
// ---------------------------------------------------------------------------

interface PWCurrently {
  temperature: number;
  apparentTemperature: number;
  humidity: number;       // 0–1
  pressure: number;       // hPa
  windSpeed: number;      // m/s (SI)
  windBearing: number;    // degrees
  uvIndex?: number;
  cloudCover: number;     // 0–1
  visibility?: number;    // km
  icon: string;
}

interface PWHourlyPoint {
  time: number;           // Unix timestamp
  temperature: number;
  precipProbability: number; // 0–1
  windSpeed: number;
  windBearing: number;
  icon: string;
}

interface PWDailyPoint {
  time: number;           // Unix timestamp
  temperatureHigh: number;
  temperatureLow: number;
  precipProbability: number; // 0–1
  windSpeed: number;
  icon: string;
}

interface PWAlert {
  title: string;
  severity: string;
  time: number;
  expires: number;
  description: string;
}

interface PWResponse {
  currently: PWCurrently;
  hourly?: { data: PWHourlyPoint[] };
  daily?: { data: PWDailyPoint[] };
  alerts?: PWAlert[];
}

// ---------------------------------------------------------------------------
// Icon → WMO code mapping
// ---------------------------------------------------------------------------

const ICON_TO_WMO: Record<string, number> = {
  'clear-day': 0,
  'clear-night': 0,
  'partly-cloudy-day': 2,
  'partly-cloudy-night': 2,
  cloudy: 3,
  rain: 61,
  snow: 71,
  fog: 45,
  thunderstorm: 95,
};

function mapIcon(icon: string): WeatherCode {
  return (ICON_TO_WMO[icon] ?? -1) as WeatherCode;
}

// ---------------------------------------------------------------------------
// Alert severity mapping
// ---------------------------------------------------------------------------

const SEVERITY_MAP: Record<string, WeatherAlert['severity']> = {
  advisory: 'minor',
  watch: 'moderate',
  warning: 'severe',
  emergency: 'extreme',
};

function mapSeverity(raw: string): WeatherAlert['severity'] {
  return SEVERITY_MAP[raw.toLowerCase()] ?? 'minor';
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class PirateWeatherAdapter extends WeatherAdapter {
  private apiKey: string;

  constructor(apiKey: string, config?: Partial<AdapterConfig>) {
    super('pirate-weather', {
      baseUrl: 'https://api.pirateweather.net/forecast',
      timeout: 10000,
      retries: 3,
      apiKey,
      ...config,
    });

    this.apiKey = apiKey;

    // Monthly quota: 10 000 → ~333 per day
    this.quota = {
      limit: 333,
      used: 0,
      resetAt: this.getNextResetTime(),
      type: 'daily',
    };
  }

  getProvider() {
    return 'pirate-weather' as const;
  }

  getBaseWeight(): number {
    return 0.20;
  }

  getDailyQuota(): number {
    return 333;
  }

  // -------------------------------------------------------------------------
  // Main fetch
  // -------------------------------------------------------------------------

  async fetch(request: WeatherRequest): Promise<AdapterResponse> {
    if (!this.hasQuota()) {
      return {
        raw: {
          provider: 'pirate-weather',
          data: { error: 'API quota exceeded' },
          fetchedAt: new Date(),
          responseTime: 0,
        },
      };
    }

    const startTime = Date.now();

    const url =
      `${this.config.baseUrl}/${this.apiKey}` +
      `/${request.latitude},${request.longitude}` +
      `?units=si&extend=hourly`;

    const response = await fetchWithRetry(
      url,
      {},
      this.config.retries,
      this.config.timeout
    );

    const data = (await response.json()) as PWResponse;
    const responseTime = Date.now() - startTime;

    this.incrementQuota();

    return {
      current: this.parseCurrent(data.currently),
      hourly: this.parseHourly(data.hourly?.data ?? [], request.hourlyHours ?? 48),
      daily: this.parseDaily(data.daily?.data ?? [], request.dailyDays ?? 7),
      alerts: this.parseAlerts(data.alerts ?? []),
      raw: {
        provider: 'pirate-weather',
        data,
        fetchedAt: new Date(),
        responseTime,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Parsers
  // -------------------------------------------------------------------------

  private parseCurrent(c: PWCurrently): CurrentWeather {
    return {
      temperature: c.temperature,
      feelsLike: c.apparentTemperature,
      humidity: Math.round(c.humidity * 100),
      pressure: c.pressure,
      windSpeed: c.windSpeed,
      windDirection: c.windBearing,
      visibility: (c.visibility ?? 0) * 1000, // km → m
      uvIndex: c.uvIndex,
      cloudCover: Math.round(c.cloudCover * 100),
      weatherCode: mapIcon(c.icon),
      weatherDescription: c.icon,
      timestamp: new Date(),
    };
  }

  private parseHourly(data: PWHourlyPoint[], hours: number): HourlyForecast[] {
    return data.slice(0, hours).map((h) => ({
      time: new Date(h.time * 1000),
      temperature: h.temperature,
      feelsLike: h.temperature,   // not provided separately
      humidity: 0,
      pressure: 0,
      windSpeed: h.windSpeed,
      windDirection: h.windBearing,
      precipitation: 0,
      precipitationProbability: Math.round(h.precipProbability * 100),
      weatherCode: mapIcon(h.icon),
      weatherDescription: h.icon,
      cloudCover: 0,
    }));
  }

  private parseDaily(data: PWDailyPoint[], days: number): DailyForecast[] {
    return data.slice(0, days).map((d) => ({
      date: new Date(d.time * 1000),
      temperatureMax: d.temperatureHigh,
      temperatureMin: d.temperatureLow,
      humidity: 0,
      pressure: 0,
      windSpeed: d.windSpeed,
      windDirection: 0,
      precipitation: 0,
      precipitationProbability: Math.round(d.precipProbability * 100),
      weatherCode: mapIcon(d.icon),
      weatherDescription: d.icon,
      sunrise: new Date(d.time * 1000),
      sunset: new Date(d.time * 1000),
    }));
  }

  private parseAlerts(alerts: PWAlert[]): WeatherAlert[] {
    return alerts.map((a, i) => ({
      id: `pw-alert-${i}`,
      event: a.title,
      headline: a.title,
      description: a.description,
      severity: mapSeverity(a.severity),
      urgency: 'expected' as const,
      start: new Date(a.time * 1000),
      end: new Date(a.expires * 1000),
      source: 'pirate-weather',
    }));
  }

  // -------------------------------------------------------------------------
  // Health check
  // -------------------------------------------------------------------------

  async healthCheck(): Promise<boolean> {
    try {
      const url =
        `${this.config.baseUrl}/${this.apiKey}/0,0?units=si`;
      const response = await fetchWithRetry(url, {}, 1, 5000);
      return response.ok;
    } catch {
      return false;
    }
  }
}
