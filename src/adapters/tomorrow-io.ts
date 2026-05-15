/**
 * Tomorrow.io API Adapter
 * Free tier: 500 calls/day, API key required
 * https://docs.tomorrow.io/reference/weather-forecast
 */

import {
  WeatherAdapter,
  type AdapterConfig,
  type AdapterResponse,
  fetchWithRetry,
} from './base.js';
import {
  WeatherCode,
  type WeatherRequest,
  type CurrentWeather,
  type HourlyForecast,
  type DailyForecast,
} from '../types/weather.js';

// ─── Tomorrow.io API response shapes ────────────────────────────────────────

interface TomorrowHourlyValue {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitationProbability: number;
  weatherCode: number;
}

interface TomorrowDailyValue {
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbabilityAvg: number;
  windSpeedAvg: number;
}

interface TomorrowHourlyEntry {
  time: string;
  values: TomorrowHourlyValue;
}

interface TomorrowDailyEntry {
  time: string;
  values: TomorrowDailyValue;
}

interface TomorrowForecastResponse {
  timelines: {
    hourly: TomorrowHourlyEntry[];
    daily: TomorrowDailyEntry[];
  };
}

interface TomorrowNowcastValue {
  precipitationIntensity: number;
  precipitationProbability: number;
}

interface TomorrowNowcastEntry {
  time: string;
  values: TomorrowNowcastValue;
}

interface TomorrowNowcastResponse {
  timelines: {
    minutely: TomorrowNowcastEntry[];
  };
}

// ─── Public return type for getNowcast ─────────────────────────────────────

export interface NowcastEntry {
  time: string;
  precipitationIntensity: number;
  precipitationProbability: number;
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class TomorrowIOAdapter extends WeatherAdapter {
  private apiKey: string;

  constructor(apiKey?: string, config?: Partial<AdapterConfig>) {
    const key = apiKey ?? process.env.TOMORROW_IO_API_KEY ?? '';
    super('tomorrow-io', {
      baseUrl: 'https://api.tomorrow.io/v4',
      timeout: 10000,
      retries: 3,
      apiKey: key,
      ...config,
    });

    this.apiKey = key;

    // Free tier: 500 calls/day. If no key is present, set limit to 0 so
    // hasQuota() returns false immediately.
    this.quota = {
      limit: key ? 500 : 0,
      used: 0,
      resetAt: this.getNextResetTime(),
      type: 'daily',
    };
  }

  getProvider() {
    return 'tomorrow-io' as const;
  }

  getBaseWeight(): number {
    return 0.25;
  }

  getDailyQuota(): number {
    return 500;
  }

  async fetch(request: WeatherRequest): Promise<AdapterResponse> {
    if (!this.apiKey || !this.hasQuota()) {
      return {
        raw: {
          provider: 'tomorrow-io',
          data: {
            error: this.apiKey ? 'API quota exceeded' : 'API key not configured',
          },
          fetchedAt: new Date(),
          responseTime: 0,
        },
      };
    }

    const startTime = Date.now();

    try {
      const params = new URLSearchParams({
        location: `${request.latitude},${request.longitude}`,
        apikey: this.apiKey,
        units: 'metric',
        timesteps: '1h,1d',
      });

      const response = await fetchWithRetry(
        `${this.config.baseUrl}/weather/forecast?${params}`,
        {},
        this.config.retries,
        this.config.timeout
      );

      const data = (await response.json()) as TomorrowForecastResponse;
      const responseTime = Date.now() - startTime;
      this.incrementQuota();

      const hourly = this.parseHourlyForecast(
        data,
        request.hourlyHours ?? 48
      );
      const daily = this.parseDailyForecast(data, request.dailyDays ?? 7);
      const current =
        data.timelines.hourly.length > 0
          ? this.hourlyToCurrent(data.timelines.hourly[0])
          : undefined;

      return {
        current,
        hourly,
        daily,
        alerts: [],
        raw: {
          provider: 'tomorrow-io',
          data,
          fetchedAt: new Date(),
          responseTime,
        },
      };
    } catch (error) {
      return {
        raw: {
          provider: 'tomorrow-io',
          data: { error: (error as Error).message },
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Get minute-by-minute precipitation nowcast for the next ~60 minutes.
   */
  async getNowcast(lat: number, lon: number): Promise<NowcastEntry[]> {
    if (!this.apiKey) {
      return [];
    }

    const params = new URLSearchParams({
      location: `${lat},${lon}`,
      apikey: this.apiKey,
      units: 'metric',
      timesteps: '1m',
      fields: 'precipitationIntensity,precipitationProbability',
    });

    try {
      const response = await fetchWithRetry(
        `${this.config.baseUrl}/weather/forecast?${params}`,
        {},
        this.config.retries,
        this.config.timeout
      );

      const data = (await response.json()) as TomorrowNowcastResponse;

      return data.timelines.minutely.map((entry) => ({
        time: entry.time,
        precipitationIntensity: entry.values.precipitationIntensity,
        precipitationProbability: entry.values.precipitationProbability,
      }));
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        location: '0,0',
        apikey: this.apiKey,
        units: 'metric',
        timesteps: '1h',
      });

      const response = await fetchWithRetry(
        `${this.config.baseUrl}/weather/forecast?${params}`,
        {},
        1,
        5000
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private hourlyToCurrent(entry: TomorrowHourlyEntry): CurrentWeather {
    const v = entry.values;
    return {
      temperature: v.temperature,
      feelsLike: v.temperature,
      humidity: v.humidity,
      pressure: 1013,
      windSpeed: v.windSpeed,
      windDirection: v.windDirection,
      visibility: 10000,
      cloudCover: 0,
      weatherCode: this.mapWeatherCode(v.weatherCode),
      weatherDescription: this.getWeatherDescription(v.weatherCode),
      timestamp: new Date(entry.time),
    };
  }

  private parseHourlyForecast(
    data: TomorrowForecastResponse,
    hours: number
  ): HourlyForecast[] {
    return data.timelines.hourly.slice(0, hours).map((entry) => {
      const v = entry.values;
      return {
        time: new Date(entry.time),
        temperature: v.temperature,
        feelsLike: v.temperature,
        humidity: v.humidity,
        pressure: 1013,
        windSpeed: v.windSpeed,
        windDirection: v.windDirection,
        precipitation: 0,
        precipitationProbability: v.precipitationProbability,
        weatherCode: this.mapWeatherCode(v.weatherCode),
        weatherDescription: this.getWeatherDescription(v.weatherCode),
        cloudCover: 0,
      };
    });
  }

  private parseDailyForecast(
    data: TomorrowForecastResponse,
    days: number
  ): DailyForecast[] {
    return data.timelines.daily.slice(0, days).map((entry) => {
      const v = entry.values;
      return {
        date: new Date(entry.time),
        temperatureMax: v.temperatureMax,
        temperatureMin: v.temperatureMin,
        humidity: 0,
        pressure: 1013,
        windSpeed: v.windSpeedAvg,
        windDirection: 0,
        precipitation: 0,
        precipitationProbability: v.precipitationProbabilityAvg,
        weatherCode: WeatherCode.UNKNOWN,
        weatherDescription: 'Unknown',
        sunrise: new Date(entry.time),
        sunset: new Date(entry.time),
      };
    });
  }

  private mapWeatherCode(tomorrowCode: number): WeatherCode {
    // Tomorrow.io proprietary codes → WMO codes
    const mapping: Record<number, number> = {
      1000: 0,   // Clear        → Clear sky
      1001: 3,   // Cloudy       → Overcast
      2000: 45,  // Fog          → Fog
      4000: 51,  // Drizzle      → Light drizzle
      4001: 61,  // Rain         → Slight rain
      5000: 71,  // Snow         → Slight snow
      8000: 95,  // Thunderstorm → Thunderstorm
    };
    return (mapping[tomorrowCode] ?? -1) as WeatherCode;
  }

  private getWeatherDescription(tomorrowCode: number): string {
    const descriptions: Record<number, string> = {
      1000: 'Clear',
      1001: 'Cloudy',
      2000: 'Fog',
      4000: 'Drizzle',
      4001: 'Rain',
      5000: 'Snow',
      8000: 'Thunderstorm',
    };
    return descriptions[tomorrowCode] ?? 'Unknown';
  }
}
