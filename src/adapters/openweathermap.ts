/**
 * OpenWeatherMap API Adapter
 * Free tier: 1,000 calls/day, API key required
 * https://openweathermap.org/api
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

interface OWMCurrentResponse {
  coord: { lon: number; lat: number };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
    sea_level?: number;
    grnd_level?: number;
  };
  visibility: number;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  clouds: { all: number };
  rain?: { '1h'?: number; '3h'?: number };
  snow?: { '1h'?: number; '3h'?: number };
  dt: number;
  sys: {
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  name: string;
}

interface OWMForecastResponse {
  list: Array<{
    dt: number;
    main: {
      temp: number;
      feels_like: number;
      temp_min: number;
      temp_max: number;
      pressure: number;
      humidity: number;
    };
    weather: Array<{
      id: number;
      main: string;
      description: string;
    }>;
    clouds: { all: number };
    wind: { speed: number; deg: number; gust?: number };
    visibility: number;
    pop: number;
    rain?: { '3h': number };
    snow?: { '3h': number };
    dt_txt: string;
  }>;
  city: {
    name: string;
    country: string;
    sunrise: number;
    sunset: number;
    timezone: number;
  };
}

export class OpenWeatherMapAdapter extends WeatherAdapter {
  private apiKey: string;

  constructor(apiKey: string, config?: Partial<AdapterConfig>) {
    super('openweathermap', {
      baseUrl: 'https://api.openweathermap.org/data/2.5',
      timeout: 10000,
      retries: 3,
      apiKey,
      ...config,
    });

    this.apiKey = apiKey;

    // Free tier: 1,000 calls/day
    this.quota = {
      limit: 1000,
      used: 0,
      resetAt: this.getNextResetTime(),
      type: 'daily',
    };
  }

  async fetch(request: WeatherRequest): Promise<AdapterResponse> {
    if (!this.hasQuota()) {
      return {
        raw: {
          provider: 'openweathermap',
          data: { error: 'API quota exceeded' },
          fetchedAt: new Date(),
          responseTime: 0,
        },
      };
    }

    const startTime = Date.now();

    // Fetch current and forecast in parallel
    const [currentResult, forecastResult] = await Promise.allSettled([
      this.fetchCurrent(request),
      this.fetchForecast(request),
    ]);

    const responseTime = Date.now() - startTime;
    this.incrementQuota();

    const forecast =
      forecastResult.status === 'fulfilled' ? forecastResult.value : null;

    return {
      current:
        currentResult.status === 'fulfilled' ? currentResult.value : undefined,
      hourly: forecast?.hourly || [],
      daily: forecast?.daily || [],
      alerts: [], // Alerts require paid tier
      raw: {
        provider: 'openweathermap',
        data: {
          current:
            currentResult.status === 'fulfilled'
              ? 'success'
              : currentResult.reason,
          forecast:
            forecastResult.status === 'fulfilled'
              ? 'success'
              : forecastResult.reason,
        },
        fetchedAt: new Date(),
        responseTime,
      },
    };
  }

  private async fetchCurrent(
    request: WeatherRequest
  ): Promise<CurrentWeather | undefined> {
    const params = new URLSearchParams({
      lat: request.latitude.toString(),
      lon: request.longitude.toString(),
      appid: this.apiKey,
      units: 'metric',
    });

    const response = await fetchWithRetry(
      `${this.config.baseUrl}/weather?${params}`,
      {},
      this.config.retries,
      this.config.timeout
    );

    const data = (await response.json()) as OWMCurrentResponse;
    return this.parseCurrentWeather(data);
  }

  private parseCurrentWeather(data: OWMCurrentResponse): CurrentWeather {
    return {
      temperature: data.main.temp,
      feelsLike: data.main.feels_like,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      windSpeed: data.wind.speed,
      windDirection: data.wind.deg,
      windGust: data.wind.gust,
      visibility: data.visibility,
      cloudCover: data.clouds.all,
      precipitation:
        (data.rain?.['1h'] || data.rain?.['3h'] || 0) +
        (data.snow?.['1h'] || data.snow?.['3h'] || 0),
      weatherCode: this.mapWeatherCode(data.weather[0]?.id || 0),
      weatherDescription: data.weather[0]?.description || 'Unknown',
      timestamp: new Date(data.dt * 1000),
    };
  }

  private async fetchForecast(
    request: WeatherRequest
  ): Promise<{ hourly: HourlyForecast[]; daily: DailyForecast[] } | null> {
    const params = new URLSearchParams({
      lat: request.latitude.toString(),
      lon: request.longitude.toString(),
      appid: this.apiKey,
      units: 'metric',
    });

    const response = await fetchWithRetry(
      `${this.config.baseUrl}/forecast?${params}`,
      {},
      this.config.retries,
      this.config.timeout
    );

    const data = (await response.json()) as OWMForecastResponse;

    const hourly = this.parseHourlyForecast(data, request.hourlyHours || 48);
    const daily = this.parseDailyForecast(data, request.dailyDays || 7);

    return { hourly, daily };
  }

  private parseHourlyForecast(
    data: OWMForecastResponse,
    hours: number
  ): HourlyForecast[] {
    // OWM free tier provides 3-hour intervals, so we interpolate
    return data.list.slice(0, Math.ceil(hours / 3)).map((item) => ({
      time: new Date(item.dt * 1000),
      temperature: item.main.temp,
      feelsLike: item.main.feels_like,
      humidity: item.main.humidity,
      pressure: item.main.pressure,
      windSpeed: item.wind.speed,
      windDirection: item.wind.deg,
      precipitation: (item.rain?.['3h'] || 0) + (item.snow?.['3h'] || 0),
      precipitationProbability: Math.round(item.pop * 100),
      weatherCode: this.mapWeatherCode(item.weather[0]?.id || 0),
      weatherDescription: item.weather[0]?.description || 'Unknown',
      cloudCover: item.clouds.all,
    }));
  }

  private parseDailyForecast(
    data: OWMForecastResponse,
    days: number
  ): DailyForecast[] {
    // Group 3-hour forecasts by day
    const dayMap = new Map<string, OWMForecastResponse['list']>();

    for (const item of data.list) {
      const date = new Date(item.dt * 1000).toISOString().split('T')[0];
      if (!dayMap.has(date)) {
        dayMap.set(date, []);
      }
      dayMap.get(date)!.push(item);
    }

    const dailyForecasts: DailyForecast[] = [];

    for (const [date, items] of dayMap) {
      if (dailyForecasts.length >= days) break;

      const temps = items.map((i) => i.main.temp);
      const maxTemp = Math.max(...temps);
      const minTemp = Math.min(...temps);
      const avgHumidity =
        items.reduce((sum, i) => sum + i.main.humidity, 0) / items.length;
      const avgPressure =
        items.reduce((sum, i) => sum + i.main.pressure, 0) / items.length;
      const maxWind = Math.max(...items.map((i) => i.wind.speed));
      const avgWindDir =
        items.reduce((sum, i) => sum + i.wind.deg, 0) / items.length;
      const totalPrecip = items.reduce(
        (sum, i) => sum + (i.rain?.['3h'] || 0) + (i.snow?.['3h'] || 0),
        0
      );
      const maxPop = Math.max(...items.map((i) => i.pop));

      // Get most common weather code (mode)
      const middayItem = items.find((i) => {
        const hour = new Date(i.dt * 1000).getHours();
        return hour >= 11 && hour <= 14;
      }) || items[Math.floor(items.length / 2)];

      dailyForecasts.push({
        date: new Date(date),
        temperatureMax: maxTemp,
        temperatureMin: minTemp,
        humidity: Math.round(avgHumidity),
        pressure: Math.round(avgPressure),
        windSpeed: maxWind,
        windDirection: Math.round(avgWindDir),
        precipitation: totalPrecip,
        precipitationProbability: Math.round(maxPop * 100),
        weatherCode: this.mapWeatherCode(middayItem.weather[0]?.id || 0),
        weatherDescription: middayItem.weather[0]?.description || 'Unknown',
        sunrise: new Date(data.city.sunrise * 1000),
        sunset: new Date(data.city.sunset * 1000),
      });
    }

    return dailyForecasts;
  }

  private mapWeatherCode(owmCode: number): WeatherCode {
    // Map OWM codes to WMO codes
    // https://openweathermap.org/weather-conditions
    const mapping: Record<number, number> = {
      // Thunderstorm
      200: 95, 201: 95, 202: 99, 210: 95, 211: 95, 212: 99, 221: 95, 230: 95, 231: 95, 232: 99,
      // Drizzle
      300: 51, 301: 53, 302: 55, 310: 51, 311: 53, 312: 55, 313: 53, 314: 55, 321: 55,
      // Rain
      500: 61, 501: 63, 502: 65, 503: 65, 504: 65, 511: 66, 520: 80, 521: 81, 522: 82, 531: 82,
      // Snow
      600: 71, 601: 73, 602: 75, 611: 77, 612: 77, 613: 77, 615: 71, 616: 73, 620: 85, 621: 85, 622: 86,
      // Atmosphere
      701: 45, 711: 45, 721: 45, 731: 45, 741: 45, 751: 45, 761: 45, 762: 45, 771: 45, 781: 45,
      // Clear
      800: 0,
      // Clouds
      801: 1, 802: 2, 803: 3, 804: 3,
    };

    return (mapping[owmCode] ?? -1) as WeatherCode;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        lat: '0',
        lon: '0',
        appid: this.apiKey,
      });

      const response = await fetchWithRetry(
        `${this.config.baseUrl}/weather?${params}`,
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
    return 0.20;
  }

  getConditionWeights(): Record<string, number> {
    return {
      temperature: 0.20,
      precipitation: 0.20,
      wind: 0.20,
      humidity: 0.25,
      uvIndex: 0.15,
      alerts: 0.10,
    };
  }
}
