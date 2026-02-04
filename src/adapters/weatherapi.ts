/**
 * WeatherAPI.com Adapter
 * Free tier: 1,000,000 calls/month, API key required
 * https://www.weatherapi.com/
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

interface WeatherAPIResponse {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    tz_id: string;
    localtime_epoch: number;
    localtime: string;
  };
  current: {
    last_updated_epoch: number;
    last_updated: string;
    temp_c: number;
    temp_f: number;
    is_day: number;
    condition: {
      text: string;
      icon: string;
      code: number;
    };
    wind_mph: number;
    wind_kph: number;
    wind_degree: number;
    wind_dir: string;
    pressure_mb: number;
    pressure_in: number;
    precip_mm: number;
    precip_in: number;
    humidity: number;
    cloud: number;
    feelslike_c: number;
    feelslike_f: number;
    vis_km: number;
    vis_miles: number;
    uv: number;
    gust_mph: number;
    gust_kph: number;
  };
  forecast?: {
    forecastday: Array<{
      date: string;
      date_epoch: number;
      day: {
        maxtemp_c: number;
        mintemp_c: number;
        avgtemp_c: number;
        maxwind_mph: number;
        maxwind_kph: number;
        totalprecip_mm: number;
        totalsnow_cm: number;
        avgvis_km: number;
        avghumidity: number;
        daily_will_it_rain: number;
        daily_chance_of_rain: number;
        daily_will_it_snow: number;
        daily_chance_of_snow: number;
        condition: {
          text: string;
          icon: string;
          code: number;
        };
        uv: number;
      };
      astro: {
        sunrise: string;
        sunset: string;
        moonrise: string;
        moonset: string;
        moon_phase: string;
        moon_illumination: number;
      };
      hour: Array<{
        time_epoch: number;
        time: string;
        temp_c: number;
        temp_f: number;
        is_day: number;
        condition: {
          text: string;
          icon: string;
          code: number;
        };
        wind_mph: number;
        wind_kph: number;
        wind_degree: number;
        wind_dir: string;
        pressure_mb: number;
        precip_mm: number;
        humidity: number;
        cloud: number;
        feelslike_c: number;
        windchill_c: number;
        heatindex_c: number;
        dewpoint_c: number;
        will_it_rain: number;
        chance_of_rain: number;
        will_it_snow: number;
        chance_of_snow: number;
        vis_km: number;
        gust_mph: number;
        gust_kph: number;
        uv: number;
      }>;
    }>;
  };
  alerts?: {
    alert: Array<{
      headline: string;
      msgtype: string;
      severity: string;
      urgency: string;
      areas: string;
      category: string;
      certainty: string;
      event: string;
      note: string;
      effective: string;
      expires: string;
      desc: string;
      instruction: string;
    }>;
  };
}

export class WeatherAPIAdapter extends WeatherAdapter {
  private apiKey: string;

  constructor(apiKey: string, config?: Partial<AdapterConfig>) {
    super('weatherapi', {
      baseUrl: 'https://api.weatherapi.com/v1',
      timeout: 10000,
      retries: 3,
      apiKey,
      ...config,
    });

    this.apiKey = apiKey;

    // Free tier: 1,000,000 calls/month
    this.quota = {
      limit: 1000000,
      used: 0,
      resetAt: this.getNextResetTime(),
      type: 'monthly',
    };
  }

  async fetch(request: WeatherRequest): Promise<AdapterResponse> {
    if (!this.hasQuota()) {
      return {
        raw: {
          provider: 'weatherapi',
          data: { error: 'API quota exceeded' },
          fetchedAt: new Date(),
          responseTime: 0,
        },
      };
    }

    const startTime = Date.now();

    const days = Math.min(request.dailyDays || 7, 10); // Free tier max 10 days
    const params = new URLSearchParams({
      key: this.apiKey,
      q: `${request.latitude},${request.longitude}`,
      days: days.toString(),
      aqi: 'no',
      alerts: request.includeAlerts !== false ? 'yes' : 'no',
    });

    try {
      const response = await fetchWithRetry(
        `${this.config.baseUrl}/forecast.json?${params}`,
        {},
        this.config.retries,
        this.config.timeout
      );

      const data = (await response.json()) as WeatherAPIResponse;
      const responseTime = Date.now() - startTime;
      this.incrementQuota();

      return {
        current: this.parseCurrentWeather(data),
        hourly: this.parseHourlyForecast(data, request.hourlyHours),
        daily: this.parseDailyForecast(data, request.dailyDays),
        alerts: this.parseAlerts(data),
        raw: {
          provider: 'weatherapi',
          data,
          fetchedAt: new Date(),
          responseTime,
        },
      };
    } catch (error) {
      return {
        raw: {
          provider: 'weatherapi',
          data: { error: (error as Error).message },
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  private parseCurrentWeather(data: WeatherAPIResponse): CurrentWeather {
    const c = data.current;
    return {
      temperature: c.temp_c,
      feelsLike: c.feelslike_c,
      humidity: c.humidity,
      pressure: c.pressure_mb,
      windSpeed: c.wind_kph / 3.6, // Convert to m/s
      windDirection: c.wind_degree,
      windGust: c.gust_kph / 3.6,
      visibility: c.vis_km * 1000, // Convert to meters
      uvIndex: c.uv,
      cloudCover: c.cloud,
      precipitation: c.precip_mm,
      weatherCode: this.mapWeatherCode(c.condition.code),
      weatherDescription: c.condition.text,
      timestamp: new Date(c.last_updated_epoch * 1000),
    };
  }

  private parseHourlyForecast(
    data: WeatherAPIResponse,
    hours = 48
  ): HourlyForecast[] {
    if (!data.forecast) return [];

    const forecasts: HourlyForecast[] = [];
    const now = Date.now();

    for (const day of data.forecast.forecastday) {
      for (const hour of day.hour) {
        // Only include future hours
        if (hour.time_epoch * 1000 > now && forecasts.length < hours) {
          forecasts.push({
            time: new Date(hour.time_epoch * 1000),
            temperature: hour.temp_c,
            feelsLike: hour.feelslike_c,
            humidity: hour.humidity,
            pressure: hour.pressure_mb,
            windSpeed: hour.wind_kph / 3.6,
            windDirection: hour.wind_degree,
            precipitation: hour.precip_mm,
            precipitationProbability: Math.max(
              hour.chance_of_rain,
              hour.chance_of_snow
            ),
            weatherCode: this.mapWeatherCode(hour.condition.code),
            weatherDescription: hour.condition.text,
            cloudCover: hour.cloud,
            uvIndex: hour.uv,
          });
        }
      }
    }

    return forecasts;
  }

  private parseDailyForecast(
    data: WeatherAPIResponse,
    days = 7
  ): DailyForecast[] {
    if (!data.forecast) return [];

    return data.forecast.forecastday.slice(0, days).map((day) => {
      // Parse sunrise/sunset times
      const dateStr = day.date;
      const sunrise = this.parseTimeString(dateStr, day.astro.sunrise);
      const sunset = this.parseTimeString(dateStr, day.astro.sunset);

      return {
        date: new Date(day.date),
        temperatureMax: day.day.maxtemp_c,
        temperatureMin: day.day.mintemp_c,
        humidity: day.day.avghumidity,
        pressure: 0, // Not provided in daily
        windSpeed: day.day.maxwind_kph / 3.6,
        windDirection: 0, // Not provided in daily
        precipitation: day.day.totalprecip_mm,
        precipitationProbability: Math.max(
          day.day.daily_chance_of_rain,
          day.day.daily_chance_of_snow
        ),
        weatherCode: this.mapWeatherCode(day.day.condition.code),
        weatherDescription: day.day.condition.text,
        sunrise,
        sunset,
        uvIndex: day.day.uv,
      };
    });
  }

  private parseTimeString(dateStr: string, timeStr: string): Date {
    // Parse time like "06:45 AM" or "07:30 PM"
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return new Date(dateStr);

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const isPM = match[3].toUpperCase() === 'PM';

    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;

    const date = new Date(dateStr);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private parseAlerts(data: WeatherAPIResponse): WeatherAlert[] {
    if (!data.alerts?.alert) return [];

    return data.alerts.alert.map((alert, index) => {
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

      return {
        id: `weatherapi-${index}-${Date.now()}`,
        event: alert.event,
        headline: alert.headline,
        description: alert.desc,
        severity: severityMap[alert.severity] || 'moderate',
        urgency: urgencyMap[alert.urgency] || 'unknown',
        start: new Date(alert.effective),
        end: new Date(alert.expires),
        source: 'WeatherAPI',
      };
    });
  }

  private mapWeatherCode(code: number): WeatherCode {
    // WeatherAPI uses its own codes
    // https://www.weatherapi.com/docs/weather_conditions.json
    const mapping: Record<number, number> = {
      1000: 0,   // Sunny/Clear
      1003: 2,   // Partly cloudy
      1006: 3,   // Cloudy
      1009: 3,   // Overcast
      1030: 45,  // Mist
      1063: 61,  // Patchy rain possible
      1066: 71,  // Patchy snow possible
      1069: 77,  // Patchy sleet possible
      1072: 56,  // Patchy freezing drizzle possible
      1087: 95,  // Thundery outbreaks possible
      1114: 73,  // Blowing snow
      1117: 75,  // Blizzard
      1135: 45,  // Fog
      1147: 48,  // Freezing fog
      1150: 51,  // Patchy light drizzle
      1153: 51,  // Light drizzle
      1168: 56,  // Freezing drizzle
      1171: 57,  // Heavy freezing drizzle
      1180: 61,  // Patchy light rain
      1183: 61,  // Light rain
      1186: 63,  // Moderate rain at times
      1189: 63,  // Moderate rain
      1192: 65,  // Heavy rain at times
      1195: 65,  // Heavy rain
      1198: 66,  // Light freezing rain
      1201: 67,  // Moderate or heavy freezing rain
      1204: 77,  // Light sleet
      1207: 77,  // Moderate or heavy sleet
      1210: 71,  // Patchy light snow
      1213: 71,  // Light snow
      1216: 73,  // Patchy moderate snow
      1219: 73,  // Moderate snow
      1222: 75,  // Patchy heavy snow
      1225: 75,  // Heavy snow
      1237: 77,  // Ice pellets
      1240: 80,  // Light rain shower
      1243: 81,  // Moderate or heavy rain shower
      1246: 82,  // Torrential rain shower
      1249: 85,  // Light sleet showers
      1252: 85,  // Moderate or heavy sleet showers
      1255: 85,  // Light snow showers
      1258: 86,  // Moderate or heavy snow showers
      1261: 77,  // Light showers of ice pellets
      1264: 77,  // Moderate or heavy showers of ice pellets
      1273: 95,  // Patchy light rain with thunder
      1276: 95,  // Moderate or heavy rain with thunder
      1279: 95,  // Patchy light snow with thunder
      1282: 99,  // Moderate or heavy snow with thunder
    };

    return (mapping[code] ?? -1) as WeatherCode;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        q: '0,0',
      });

      const response = await fetchWithRetry(
        `${this.config.baseUrl}/current.json?${params}`,
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
    return 0.15;
  }

  getConditionWeights(): Record<string, number> {
    return {
      temperature: 0.15,
      precipitation: 0.15,
      wind: 0.15,
      humidity: 0.15,
      uvIndex: 0.20,
      alerts: 0.15,
    };
  }
}
