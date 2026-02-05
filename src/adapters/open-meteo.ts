/**
 * Open-Meteo API Adapter
 * Free, no API key required, unlimited non-commercial use
 * https://open-meteo.com/
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
  WeatherCode,
} from '../types/weather.js';
import { getWeatherDescription } from '../types/weather.js';

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current?: {
    time: string;
    interval: number;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    rain: number;
    showers: number;
    snowfall: number;
    weather_code: number;
    cloud_cover: number;
    pressure_msl: number;
    surface_pressure: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    apparent_temperature: number[];
    precipitation_probability: number[];
    precipitation: number[];
    rain: number[];
    showers: number[];
    snowfall: number[];
    weather_code: number[];
    cloud_cover: number[];
    pressure_msl: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_gusts_10m: number[];
    uv_index: number[];
    cape: number[];
    visibility: number[];
    freezing_level_height: number[];
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    apparent_temperature_max: number[];
    apparent_temperature_min: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
    precipitation_sum: number[];
    rain_sum: number[];
    showers_sum: number[];
    snowfall_sum: number[];
    precipitation_hours: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    wind_direction_10m_dominant: number[];
  };
}

export class OpenMeteoAdapter extends WeatherAdapter {
  constructor(config?: Partial<AdapterConfig>) {
    super('open-meteo', {
      baseUrl: 'https://api.open-meteo.com/v1',
      timeout: 10000,
      retries: 3,
      ...config,
    });

    // Open-Meteo has unlimited non-commercial use
    this.quota = {
      limit: Infinity,
      used: 0,
      resetAt: new Date(),
      type: 'unlimited',
    };
  }

  async fetch(request: WeatherRequest): Promise<AdapterResponse> {
    const startTime = Date.now();

    const params = new URLSearchParams({
      latitude: request.latitude.toString(),
      longitude: request.longitude.toString(),
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'rain',
        'showers',
        'snowfall',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
      ].join(','),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation_probability',
        'precipitation',
        'rain',
        'showers',
        'snowfall',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'uv_index',
        'cape',
        'visibility',
        'freezing_level_height',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'apparent_temperature_max',
        'apparent_temperature_min',
        'sunrise',
        'sunset',
        'uv_index_max',
        'precipitation_sum',
        'rain_sum',
        'showers_sum',
        'snowfall_sum',
        'precipitation_hours',
        'precipitation_probability_max',
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'wind_direction_10m_dominant',
      ].join(','),
      timezone: 'auto',
      forecast_days: (request.dailyDays || 7).toString(),
      forecast_hours: (request.hourlyHours || 48).toString(),
    });

    const url = `${this.config.baseUrl}/forecast?${params}`;

    const response = await fetchWithRetry(
      url,
      {},
      this.config.retries,
      this.config.timeout
    );

    const data = (await response.json()) as OpenMeteoResponse;
    const responseTime = Date.now() - startTime;

    this.incrementQuota();

    return {
      current: this.parseCurrentWeather(data),
      hourly: this.parseHourlyForecast(data, request.hourlyHours),
      daily: this.parseDailyForecast(data, request.dailyDays),
      alerts: [], // Open-Meteo doesn't provide alerts in the free tier
      raw: {
        provider: 'open-meteo',
        data,
        fetchedAt: new Date(),
        responseTime,
      },
    };
  }

  private parseCurrentWeather(data: OpenMeteoResponse): CurrentWeather | undefined {
    if (!data.current) return undefined;

    const c = data.current;
    return {
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      pressure: c.pressure_msl,
      windSpeed: c.wind_speed_10m / 3.6, // Convert km/h to m/s
      windDirection: c.wind_direction_10m,
      windGust: c.wind_gusts_10m / 3.6,
      visibility: 10000, // Not provided by Open-Meteo
      uvIndex: undefined,
      cloudCover: c.cloud_cover,
      precipitation: c.precipitation,
      weatherCode: c.weather_code as WeatherCode,
      weatherDescription: getWeatherDescription(c.weather_code as WeatherCode),
      timestamp: new Date(c.time),
    };
  }

  private parseHourlyForecast(
    data: OpenMeteoResponse,
    hours = 48
  ): HourlyForecast[] {
    if (!data.hourly) return [];

    const h = data.hourly;
    const forecasts: HourlyForecast[] = [];

    for (let i = 0; i < Math.min(h.time.length, hours); i++) {
      forecasts.push({
        time: new Date(h.time[i]),
        temperature: h.temperature_2m[i],
        feelsLike: h.apparent_temperature[i],
        humidity: h.relative_humidity_2m[i],
        pressure: h.pressure_msl[i],
        windSpeed: h.wind_speed_10m[i] / 3.6,
        windDirection: h.wind_direction_10m[i],
        windGust: h.wind_gusts_10m?.[i] ? h.wind_gusts_10m[i] / 3.6 : undefined,
        precipitation: h.precipitation[i],
        rain: h.rain?.[i],
        showers: h.showers?.[i],
        snowfall: h.snowfall?.[i],
        precipitationProbability: h.precipitation_probability[i],
        weatherCode: h.weather_code[i] as WeatherCode,
        weatherDescription: getWeatherDescription(h.weather_code[i] as WeatherCode),
        cloudCover: h.cloud_cover[i],
        uvIndex: h.uv_index[i],
        cape: h.cape?.[i],
        visibility: h.visibility?.[i],
        freezingLevel: h.freezing_level_height?.[i],
      });
    }

    return forecasts;
  }

  private parseDailyForecast(
    data: OpenMeteoResponse,
    days = 7
  ): DailyForecast[] {
    if (!data.daily) return [];

    const d = data.daily;
    const forecasts: DailyForecast[] = [];

    for (let i = 0; i < Math.min(d.time.length, days); i++) {
      forecasts.push({
        date: new Date(d.time[i]),
        temperatureMax: d.temperature_2m_max[i],
        temperatureMin: d.temperature_2m_min[i],
        humidity: 0, // Not provided in daily
        pressure: 0, // Not provided in daily
        windSpeed: d.wind_speed_10m_max[i] / 3.6,
        windGust: d.wind_gusts_10m_max?.[i] ? d.wind_gusts_10m_max[i] / 3.6 : undefined,
        windDirection: d.wind_direction_10m_dominant[i],
        precipitation: d.precipitation_sum[i],
        rain: d.rain_sum?.[i],
        showers: d.showers_sum?.[i],
        snowfall: d.snowfall_sum?.[i],
        precipitationHours: d.precipitation_hours?.[i],
        precipitationProbability: d.precipitation_probability_max[i],
        weatherCode: d.weather_code[i] as WeatherCode,
        weatherDescription: getWeatherDescription(d.weather_code[i] as WeatherCode),
        sunrise: new Date(d.sunrise[i]),
        sunset: new Date(d.sunset[i]),
        uvIndex: d.uv_index_max[i],
      });
    }

    return forecasts;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetchWithRetry(
        `${this.config.baseUrl}/forecast?latitude=0&longitude=0&current=temperature_2m`,
        {},
        1,
        5000
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  getBaseWeight(): number {
    // Open-Meteo uses ECMWF and other high-quality models
    return 0.30;
  }

  getConditionWeights(): Record<string, number> {
    return {
      temperature: 0.30,
      precipitation: 0.25,
      wind: 0.30,
      humidity: 0.30,
      uvIndex: 0.25,
      alerts: 0.05, // No alerts in free tier
    };
  }
}
