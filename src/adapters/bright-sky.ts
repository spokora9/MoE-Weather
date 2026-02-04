/**
 * Bright Sky API Adapter (German DWD - Deutscher Wetterdienst)
 * Free, no API key required, best for Germany and Central Europe
 * https://brightsky.dev/
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
import { getWeatherDescription } from '../types/weather.js';

interface BrightSkyWeatherResponse {
  weather: Array<{
    timestamp: string;
    source_id: number;
    precipitation: number;
    pressure_msl: number;
    sunshine: number;
    temperature: number;
    wind_direction: number;
    wind_speed: number;
    cloud_cover: number;
    dew_point: number;
    relative_humidity: number;
    visibility: number;
    wind_gust_direction: number;
    wind_gust_speed: number;
    condition: string;
    icon: string;
  }>;
  sources: Array<{
    id: number;
    dwd_station_id: string;
    observation_type: string;
    lat: number;
    lon: number;
    height: number;
    station_name: string;
    wmo_station_id: string;
    first_record: string;
    last_record: string;
    distance: number;
  }>;
}

interface BrightSkyAlertsResponse {
  alerts: Array<{
    id: number;
    alert_id: string;
    effective: string;
    onset: string;
    expires: string;
    category: string;
    response_type: string;
    urgency: string;
    severity: string;
    certainty: string;
    event_code: number;
    event_en: string;
    event_de: string;
    headline_en: string;
    headline_de: string;
    description_en: string;
    description_de: string;
    instruction_en: string;
    instruction_de: string;
  }>;
}

export class BrightSkyAdapter extends WeatherAdapter {
  constructor(config?: Partial<AdapterConfig>) {
    super('open-meteo', { // Using 'open-meteo' as provider type since BrightSky is similar
      baseUrl: 'https://api.brightsky.dev',
      timeout: 10000,
      retries: 3,
      ...config,
    });

    // Bright Sky has no rate limits for reasonable usage
    this.quota = {
      limit: Infinity,
      used: 0,
      resetAt: new Date(),
      type: 'unlimited',
    };
  }

  /**
   * Check if location is in Germany or nearby regions where DWD has good coverage
   */
  isInCoverageArea(lat: number, lon: number): boolean {
    // Germany and surrounding areas (roughly)
    // Lat: 47-55, Lon: 5-15 for Germany
    // Extended to nearby countries for partial coverage
    return lat >= 45 && lat <= 57 && lon >= 3 && lon <= 18;
  }

  async fetch(request: WeatherRequest): Promise<AdapterResponse> {
    const startTime = Date.now();

    // Check if location is in coverage area
    if (!this.isInCoverageArea(request.latitude, request.longitude)) {
      return {
        raw: {
          provider: 'open-meteo', // Bright Sky maps to this
          data: { error: 'Location outside Bright Sky (DWD) coverage area' },
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        },
      };
    }

    try {
      // Calculate date range
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + (request.dailyDays || 7));

      const params = new URLSearchParams({
        lat: request.latitude.toString(),
        lon: request.longitude.toString(),
        date: now.toISOString().split('T')[0],
        last_date: endDate.toISOString().split('T')[0],
      });

      // Fetch weather and alerts in parallel
      const [weatherResult, alertsResult] = await Promise.allSettled([
        fetchWithRetry(
          `${this.config.baseUrl}/weather?${params}`,
          {},
          this.config.retries,
          this.config.timeout
        ),
        request.includeAlerts !== false
          ? fetchWithRetry(
              `${this.config.baseUrl}/alerts?lat=${request.latitude}&lon=${request.longitude}`,
              {},
              2,
              5000
            )
          : Promise.resolve(null),
      ]);

      const responseTime = Date.now() - startTime;
      this.incrementQuota();

      if (weatherResult.status === 'rejected') {
        throw weatherResult.reason;
      }

      const weatherData: BrightSkyWeatherResponse = await weatherResult.value.json();

      let alerts: WeatherAlert[] = [];
      if (alertsResult.status === 'fulfilled' && alertsResult.value) {
        try {
          const alertsData: BrightSkyAlertsResponse = await alertsResult.value.json();
          alerts = this.parseAlerts(alertsData);
        } catch {
          // Alerts parsing failed, continue without alerts
        }
      }

      return {
        current: this.parseCurrentWeather(weatherData),
        hourly: this.parseHourlyForecast(weatherData, request.hourlyHours),
        daily: this.parseDailyForecast(weatherData, request.dailyDays),
        alerts,
        raw: {
          provider: 'open-meteo',
          data: weatherData,
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

  private parseCurrentWeather(data: BrightSkyWeatherResponse): CurrentWeather | undefined {
    if (!data.weather || data.weather.length === 0) return undefined;

    // Find the closest observation to now
    const now = Date.now();
    let closest = data.weather[0];
    let closestDiff = Math.abs(new Date(closest.timestamp).getTime() - now);

    for (const w of data.weather) {
      const diff = Math.abs(new Date(w.timestamp).getTime() - now);
      if (diff < closestDiff) {
        closest = w;
        closestDiff = diff;
      }
    }

    return {
      temperature: closest.temperature,
      feelsLike: closest.temperature, // DWD doesn't provide feels like
      humidity: closest.relative_humidity,
      pressure: closest.pressure_msl,
      windSpeed: closest.wind_speed / 3.6, // Convert km/h to m/s
      windDirection: closest.wind_direction,
      windGust: closest.wind_gust_speed ? closest.wind_gust_speed / 3.6 : undefined,
      visibility: closest.visibility,
      cloudCover: closest.cloud_cover,
      precipitation: closest.precipitation,
      weatherCode: this.mapConditionToCode(closest.condition),
      weatherDescription: this.formatCondition(closest.condition),
      timestamp: new Date(closest.timestamp),
    };
  }

  private parseHourlyForecast(
    data: BrightSkyWeatherResponse,
    hours = 48
  ): HourlyForecast[] {
    if (!data.weather) return [];

    const now = Date.now();
    const futureWeather = data.weather.filter(
      (w) => new Date(w.timestamp).getTime() > now
    );

    return futureWeather.slice(0, hours).map((w) => ({
      time: new Date(w.timestamp),
      temperature: w.temperature,
      feelsLike: w.temperature,
      humidity: w.relative_humidity,
      pressure: w.pressure_msl,
      windSpeed: w.wind_speed / 3.6,
      windDirection: w.wind_direction,
      precipitation: w.precipitation,
      precipitationProbability: 0, // Not provided by Bright Sky
      weatherCode: this.mapConditionToCode(w.condition),
      weatherDescription: this.formatCondition(w.condition),
      cloudCover: w.cloud_cover,
    }));
  }

  private parseDailyForecast(
    data: BrightSkyWeatherResponse,
    days = 7
  ): DailyForecast[] {
    if (!data.weather) return [];

    // Group by day
    const dayMap = new Map<string, BrightSkyWeatherResponse['weather']>();

    for (const w of data.weather) {
      const date = w.timestamp.split('T')[0];
      if (!dayMap.has(date)) {
        dayMap.set(date, []);
      }
      dayMap.get(date)!.push(w);
    }

    const dailyForecasts: DailyForecast[] = [];

    for (const [date, hourlyData] of dayMap) {
      if (dailyForecasts.length >= days) break;
      if (hourlyData.length === 0) continue;

      const temps = hourlyData.map((h) => h.temperature);
      const maxTemp = Math.max(...temps);
      const minTemp = Math.min(...temps);
      const avgHumidity =
        hourlyData.reduce((sum, h) => sum + h.relative_humidity, 0) /
        hourlyData.length;
      const avgPressure =
        hourlyData.reduce((sum, h) => sum + h.pressure_msl, 0) /
        hourlyData.length;
      const maxWind = Math.max(...hourlyData.map((h) => h.wind_speed));
      const totalPrecip = hourlyData.reduce((sum, h) => sum + h.precipitation, 0);

      // Get midday weather for condition
      const middayData = hourlyData.find((h) => {
        const hour = new Date(h.timestamp).getHours();
        return hour >= 11 && hour <= 14;
      }) || hourlyData[Math.floor(hourlyData.length / 2)];

      dailyForecasts.push({
        date: new Date(date),
        temperatureMax: maxTemp,
        temperatureMin: minTemp,
        humidity: Math.round(avgHumidity),
        pressure: Math.round(avgPressure),
        windSpeed: maxWind / 3.6,
        windDirection: middayData.wind_direction,
        precipitation: totalPrecip,
        precipitationProbability: 0,
        weatherCode: this.mapConditionToCode(middayData.condition),
        weatherDescription: this.formatCondition(middayData.condition),
        sunrise: new Date(`${date}T06:00:00`), // Approximate
        sunset: new Date(`${date}T20:00:00`), // Approximate
      });
    }

    return dailyForecasts;
  }

  private parseAlerts(data: BrightSkyAlertsResponse): WeatherAlert[] {
    if (!data.alerts) return [];

    const severityMap: Record<string, WeatherAlert['severity']> = {
      Minor: 'minor',
      Moderate: 'moderate',
      Severe: 'severe',
      Extreme: 'extreme',
    };

    const urgencyMap: Record<string, WeatherAlert['urgency']> = {
      Immediate: 'immediate',
      Expected: 'expected',
      Future: 'future',
      Past: 'past',
      Unknown: 'unknown',
    };

    return data.alerts.map((a) => ({
      id: a.alert_id,
      event: a.event_en || a.event_de,
      headline: a.headline_en || a.headline_de,
      description: a.description_en || a.description_de,
      severity: severityMap[a.severity] || 'moderate',
      urgency: urgencyMap[a.urgency] || 'unknown',
      start: new Date(a.onset || a.effective),
      end: new Date(a.expires),
      source: 'DWD',
    }));
  }

  private mapConditionToCode(condition: string): WeatherCode {
    const mapping: Record<string, number> = {
      'clear-day': 0,
      'clear-night': 0,
      'partly-cloudy-day': 2,
      'partly-cloudy-night': 2,
      cloudy: 3,
      fog: 45,
      wind: 0,
      rain: 61,
      sleet: 77,
      snow: 71,
      hail: 99,
      thunderstorm: 95,
    };
    return (mapping[condition] ?? -1) as WeatherCode;
  }

  private formatCondition(condition: string): string {
    return condition
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check with Berlin coordinates
      const response = await fetchWithRetry(
        `${this.config.baseUrl}/weather?lat=52.52&lon=13.405&date=${new Date().toISOString().split('T')[0]}`,
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
    return 0.25; // High weight for German/Central European locations
  }

  getConditionWeights(): Record<string, number> {
    return {
      temperature: 0.28,
      precipitation: 0.30,
      wind: 0.25,
      humidity: 0.25,
      uvIndex: 0.15,
      alerts: 0.35, // DWD has excellent severe weather alerts for Germany
    };
  }
}
