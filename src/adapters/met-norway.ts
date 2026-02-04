/**
 * MET Norway (Meteorologisk institutt) API Adapter
 * Free, no API key required, best for Nordic countries
 * https://api.met.no/
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

interface MetNorwayResponse {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number, number];
  };
  properties: {
    meta: {
      updated_at: string;
      units: {
        air_pressure_at_sea_level: string;
        air_temperature: string;
        cloud_area_fraction: string;
        precipitation_amount: string;
        relative_humidity: string;
        wind_from_direction: string;
        wind_speed: string;
      };
    };
    timeseries: Array<{
      time: string;
      data: {
        instant: {
          details: {
            air_pressure_at_sea_level: number;
            air_temperature: number;
            cloud_area_fraction: number;
            relative_humidity: number;
            wind_from_direction: number;
            wind_speed: number;
            wind_speed_of_gust?: number;
            ultraviolet_index_clear_sky?: number;
          };
        };
        next_1_hours?: {
          summary: { symbol_code: string };
          details: { precipitation_amount: number };
        };
        next_6_hours?: {
          summary: { symbol_code: string };
          details: {
            precipitation_amount: number;
            air_temperature_max: number;
            air_temperature_min: number;
          };
        };
        next_12_hours?: {
          summary: { symbol_code: string };
          details: { probability_of_precipitation: number };
        };
      };
    }>;
  };
}

export class MetNorwayAdapter extends WeatherAdapter {
  constructor(config?: Partial<AdapterConfig>) {
    super('open-meteo', { // Map to open-meteo type for compatibility
      baseUrl: 'https://api.met.no/weatherapi/locationforecast/2.0',
      timeout: 10000,
      retries: 3,
      ...config,
    });

    // MET Norway requires User-Agent but has no rate limits for reasonable usage
    this.quota = {
      limit: Infinity,
      used: 0,
      resetAt: new Date(),
      type: 'unlimited',
    };
  }

  /**
   * Check if location is in Nordic region where MET Norway has best coverage
   */
  isInCoverageArea(lat: number, lon: number): boolean {
    // Nordic countries and nearby: Norway, Sweden, Finland, Denmark, Iceland
    // Lat: 54-72, Lon: -25 to 32
    return lat >= 54 && lat <= 72 && lon >= -25 && lon <= 32;
  }

  async fetch(request: WeatherRequest): Promise<AdapterResponse> {
    const startTime = Date.now();

    // MET Norway works globally but is most accurate for Nordic region
    // We'll still use it but with lower weight for non-Nordic locations

    try {
      const response = await fetchWithRetry(
        `${this.config.baseUrl}/compact?lat=${request.latitude}&lon=${request.longitude}`,
        {
          headers: {
            'User-Agent': 'MoE-Weather/1.0 github.com/moe-weather',
          },
        },
        this.config.retries,
        this.config.timeout
      );

      const data: MetNorwayResponse = await response.json();
      const responseTime = Date.now() - startTime;
      this.incrementQuota();

      return {
        current: this.parseCurrentWeather(data),
        hourly: this.parseHourlyForecast(data, request.hourlyHours),
        daily: this.parseDailyForecast(data, request.dailyDays),
        alerts: [], // MET Norway alerts require separate endpoint
        raw: {
          provider: 'open-meteo',
          data,
          fetchedAt: new Date(),
          responseTime,
        },
      };
    } catch (error) {
      return {
        raw: {
          provider: 'open-meteo',
          data: { error: (error as Error).message },
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  private parseCurrentWeather(data: MetNorwayResponse): CurrentWeather | undefined {
    if (!data.properties?.timeseries?.length) return undefined;

    const current = data.properties.timeseries[0];
    const instant = current.data.instant.details;
    const next1h = current.data.next_1_hours;

    return {
      temperature: instant.air_temperature,
      feelsLike: instant.air_temperature, // Not provided, would need calculation
      humidity: instant.relative_humidity,
      pressure: instant.air_pressure_at_sea_level,
      windSpeed: instant.wind_speed,
      windDirection: instant.wind_from_direction,
      windGust: instant.wind_speed_of_gust,
      visibility: 10000, // Not provided
      uvIndex: instant.ultraviolet_index_clear_sky,
      cloudCover: instant.cloud_area_fraction,
      precipitation: next1h?.details.precipitation_amount,
      weatherCode: this.mapSymbolToCode(next1h?.summary.symbol_code || 'clearsky_day'),
      weatherDescription: this.formatSymbol(next1h?.summary.symbol_code || 'clearsky_day'),
      timestamp: new Date(current.time),
    };
  }

  private parseHourlyForecast(
    data: MetNorwayResponse,
    hours = 48
  ): HourlyForecast[] {
    if (!data.properties?.timeseries) return [];

    const now = Date.now();
    const forecasts: HourlyForecast[] = [];

    for (const ts of data.properties.timeseries) {
      if (forecasts.length >= hours) break;
      if (new Date(ts.time).getTime() <= now) continue;

      const instant = ts.data.instant.details;
      const next1h = ts.data.next_1_hours;
      const next12h = ts.data.next_12_hours;

      forecasts.push({
        time: new Date(ts.time),
        temperature: instant.air_temperature,
        feelsLike: instant.air_temperature,
        humidity: instant.relative_humidity,
        pressure: instant.air_pressure_at_sea_level,
        windSpeed: instant.wind_speed,
        windDirection: instant.wind_from_direction,
        precipitation: next1h?.details.precipitation_amount || 0,
        precipitationProbability: next12h?.details.probability_of_precipitation || 0,
        weatherCode: this.mapSymbolToCode(
          next1h?.summary.symbol_code || 'clearsky_day'
        ),
        weatherDescription: this.formatSymbol(
          next1h?.summary.symbol_code || 'clearsky_day'
        ),
        cloudCover: instant.cloud_area_fraction,
        uvIndex: instant.ultraviolet_index_clear_sky,
      });
    }

    return forecasts;
  }

  private parseDailyForecast(
    data: MetNorwayResponse,
    days = 7
  ): DailyForecast[] {
    if (!data.properties?.timeseries) return [];

    // Group by day
    const dayMap = new Map<string, MetNorwayResponse['properties']['timeseries']>();

    for (const ts of data.properties.timeseries) {
      const date = ts.time.split('T')[0];
      if (!dayMap.has(date)) {
        dayMap.set(date, []);
      }
      dayMap.get(date)!.push(ts);
    }

    const dailyForecasts: DailyForecast[] = [];

    for (const [date, hourlyData] of dayMap) {
      if (dailyForecasts.length >= days) break;
      if (hourlyData.length === 0) continue;

      const temps = hourlyData.map((h) => h.data.instant.details.air_temperature);
      const maxTemp = Math.max(...temps);
      const minTemp = Math.min(...temps);

      const avgHumidity =
        hourlyData.reduce(
          (sum, h) => sum + h.data.instant.details.relative_humidity,
          0
        ) / hourlyData.length;

      const avgPressure =
        hourlyData.reduce(
          (sum, h) => sum + h.data.instant.details.air_pressure_at_sea_level,
          0
        ) / hourlyData.length;

      const maxWind = Math.max(
        ...hourlyData.map((h) => h.data.instant.details.wind_speed)
      );

      const totalPrecip = hourlyData.reduce((sum, h) => {
        return sum + (h.data.next_1_hours?.details.precipitation_amount || 0);
      }, 0);

      // Get midday weather for condition
      const middayData = hourlyData.find((h) => {
        const hour = new Date(h.time).getHours();
        return hour >= 11 && hour <= 14;
      }) || hourlyData[Math.floor(hourlyData.length / 2)];

      const symbolCode =
        middayData.data.next_1_hours?.summary.symbol_code ||
        middayData.data.next_6_hours?.summary.symbol_code ||
        'clearsky_day';

      dailyForecasts.push({
        date: new Date(date),
        temperatureMax: maxTemp,
        temperatureMin: minTemp,
        humidity: Math.round(avgHumidity),
        pressure: Math.round(avgPressure),
        windSpeed: maxWind,
        windDirection: middayData.data.instant.details.wind_from_direction,
        precipitation: totalPrecip,
        precipitationProbability: 0,
        weatherCode: this.mapSymbolToCode(symbolCode),
        weatherDescription: this.formatSymbol(symbolCode),
        sunrise: new Date(`${date}T06:00:00`), // Approximate
        sunset: new Date(`${date}T20:00:00`), // Approximate
      });
    }

    return dailyForecasts;
  }

  private mapSymbolToCode(symbol: string): WeatherCode {
    // MET Norway symbol codes mapping
    // https://api.met.no/weatherapi/weathericon/2.0/documentation
    const baseSymbol = symbol.replace(/_day|_night|_polartwilight/g, '');

    const mapping: Record<string, number> = {
      clearsky: 0,
      fair: 1,
      partlycloudy: 2,
      cloudy: 3,
      fog: 45,
      lightrainshowers: 80,
      rainshowers: 81,
      heavyrainshowers: 82,
      lightrainshowersandthunder: 95,
      rainshowersandthunder: 95,
      heavyrainshowersandthunder: 99,
      lightsleetshowers: 85,
      sleetshowers: 85,
      heavysleetshowers: 86,
      lightsnowshowers: 85,
      snowshowers: 85,
      heavysnowshowers: 86,
      lightrain: 61,
      rain: 63,
      heavyrain: 65,
      lightrainandthunder: 95,
      rainandthunder: 95,
      heavyrainandthunder: 99,
      lightsleet: 77,
      sleet: 77,
      heavysleet: 77,
      lightsnow: 71,
      snow: 73,
      heavysnow: 75,
      lightsleetandthunder: 95,
      sleetandthunder: 95,
      heavysleetandthunder: 99,
      lightsnowandthunder: 95,
      snowandthunder: 95,
      heavysnowandthunder: 99,
    };

    return (mapping[baseSymbol] ?? -1) as WeatherCode;
  }

  private formatSymbol(symbol: string): string {
    const baseSymbol = symbol.replace(/_day|_night|_polartwilight/g, '');

    const descriptions: Record<string, string> = {
      clearsky: 'Clear sky',
      fair: 'Fair',
      partlycloudy: 'Partly cloudy',
      cloudy: 'Cloudy',
      fog: 'Fog',
      lightrainshowers: 'Light rain showers',
      rainshowers: 'Rain showers',
      heavyrainshowers: 'Heavy rain showers',
      lightrainshowersandthunder: 'Light rain showers and thunder',
      rainshowersandthunder: 'Rain showers and thunder',
      heavyrainshowersandthunder: 'Heavy rain showers and thunder',
      lightsleetshowers: 'Light sleet showers',
      sleetshowers: 'Sleet showers',
      heavysleetshowers: 'Heavy sleet showers',
      lightsnowshowers: 'Light snow showers',
      snowshowers: 'Snow showers',
      heavysnowshowers: 'Heavy snow showers',
      lightrain: 'Light rain',
      rain: 'Rain',
      heavyrain: 'Heavy rain',
      lightrainandthunder: 'Light rain and thunder',
      rainandthunder: 'Rain and thunder',
      heavyrainandthunder: 'Heavy rain and thunder',
      lightsleet: 'Light sleet',
      sleet: 'Sleet',
      heavysleet: 'Heavy sleet',
      lightsnow: 'Light snow',
      snow: 'Snow',
      heavysnow: 'Heavy snow',
      lightsleetandthunder: 'Light sleet and thunder',
      sleetandthunder: 'Sleet and thunder',
      heavysleetandthunder: 'Heavy sleet and thunder',
      lightsnowandthunder: 'Light snow and thunder',
      snowandthunder: 'Snow and thunder',
      heavysnowandthunder: 'Heavy snow and thunder',
    };

    return descriptions[baseSymbol] || getWeatherDescription(-1 as WeatherCode);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetchWithRetry(
        `${this.config.baseUrl}/compact?lat=59.91&lon=10.75`, // Oslo
        {
          headers: {
            'User-Agent': 'MoE-Weather/1.0 github.com/moe-weather',
          },
        },
        1,
        5000
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  getBaseWeight(): number {
    return 0.25; // High weight for Nordic locations
  }

  getConditionWeights(): Record<string, number> {
    return {
      temperature: 0.28,
      precipitation: 0.30,
      wind: 0.28,
      humidity: 0.25,
      uvIndex: 0.20,
      alerts: 0.20,
    };
  }
}
