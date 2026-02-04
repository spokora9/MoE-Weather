/**
 * National Weather Service (NWS) API Adapter
 * Free, no API key required, US-only coverage
 * https://www.weather.gov/documentation/services-web-api
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

interface NWSPointsResponse {
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
    timeZone: string;
  };
}

interface NWSForecastResponse {
  properties: {
    updated: string;
    periods: NWSForecastPeriod[];
  };
}

interface NWSForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  temperatureTrend: string | null;
  probabilityOfPrecipitation: { value: number | null };
  dewpoint: { value: number; unitCode: string };
  relativeHumidity: { value: number };
  windSpeed: string;
  windDirection: string;
  icon: string;
  shortForecast: string;
  detailedForecast: string;
}

interface NWSObservationResponse {
  properties: {
    timestamp: string;
    textDescription: string;
    icon: string;
    temperature: { value: number; unitCode: string };
    dewpoint: { value: number; unitCode: string };
    windDirection: { value: number };
    windSpeed: { value: number; unitCode: string };
    windGust: { value: number | null; unitCode: string };
    barometricPressure: { value: number; unitCode: string };
    seaLevelPressure: { value: number; unitCode: string };
    visibility: { value: number; unitCode: string };
    relativeHumidity: { value: number };
    windChill: { value: number | null };
    heatIndex: { value: number | null };
    cloudLayers: Array<{
      base: { value: number };
      amount: string;
    }>;
  };
}

interface NWSAlertsResponse {
  features: Array<{
    properties: {
      id: string;
      areaDesc: string;
      sent: string;
      effective: string;
      onset: string;
      expires: string;
      ends: string;
      status: string;
      messageType: string;
      category: string;
      severity: string;
      certainty: string;
      urgency: string;
      event: string;
      sender: string;
      senderName: string;
      headline: string;
      description: string;
      instruction: string;
      response: string;
    };
  }>;
}

export class NWSAdapter extends WeatherAdapter {
  private pointsCache: Map<string, NWSPointsResponse> = new Map();

  constructor(config?: Partial<AdapterConfig>) {
    super('nws', {
      baseUrl: 'https://api.weather.gov',
      timeout: 15000,
      retries: 3,
      ...config,
    });

    this.quota = {
      limit: Infinity,
      used: 0,
      resetAt: new Date(),
      type: 'unlimited',
    };
  }

  private getCacheKey(lat: number, lon: number): string {
    // Round to 4 decimal places for caching
    return `${lat.toFixed(4)},${lon.toFixed(4)}`;
  }

  private async getPoints(lat: number, lon: number): Promise<NWSPointsResponse | null> {
    const cacheKey = this.getCacheKey(lat, lon);

    if (this.pointsCache.has(cacheKey)) {
      return this.pointsCache.get(cacheKey)!;
    }

    try {
      const response = await fetchWithRetry(
        `${this.config.baseUrl}/points/${lat},${lon}`,
        {
          headers: {
            'User-Agent': 'MoE-Weather-App (contact@example.com)',
            Accept: 'application/geo+json',
          },
        },
        this.config.retries,
        this.config.timeout
      );

      const data = (await response.json()) as NWSPointsResponse;
      this.pointsCache.set(cacheKey, data);
      return data;
    } catch {
      return null;
    }
  }

  async fetch(request: WeatherRequest): Promise<AdapterResponse> {
    const startTime = Date.now();

    // Check if location is in the US (NWS only covers US territories)
    if (!this.isUSLocation(request.latitude, request.longitude)) {
      return {
        raw: {
          provider: 'nws',
          data: { error: 'Location outside NWS coverage area' },
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        },
      };
    }

    const points = await this.getPoints(request.latitude, request.longitude);
    if (!points) {
      return {
        raw: {
          provider: 'nws',
          data: { error: 'Failed to get NWS grid points' },
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        },
      };
    }

    // Fetch data in parallel
    const [currentResult, hourlyResult, dailyResult, alertsResult] =
      await Promise.allSettled([
        this.fetchCurrentObservation(points),
        this.fetchHourlyForecast(points, request.hourlyHours),
        this.fetchDailyForecast(points, request.dailyDays),
        request.includeAlerts !== false
          ? this.fetchAlerts(request.latitude, request.longitude)
          : Promise.resolve([]),
      ]);

    const responseTime = Date.now() - startTime;
    this.incrementQuota();

    return {
      current:
        currentResult.status === 'fulfilled' ? currentResult.value : undefined,
      hourly:
        hourlyResult.status === 'fulfilled' ? hourlyResult.value : undefined,
      daily:
        dailyResult.status === 'fulfilled' ? dailyResult.value : undefined,
      alerts:
        alertsResult.status === 'fulfilled' ? alertsResult.value : [],
      raw: {
        provider: 'nws',
        data: { points },
        fetchedAt: new Date(),
        responseTime,
      },
    };
  }

  private async fetchCurrentObservation(
    points: NWSPointsResponse
  ): Promise<CurrentWeather | undefined> {
    try {
      // Get nearest station
      const stationsResponse = await fetchWithRetry(
        points.properties.observationStations,
        {
          headers: {
            'User-Agent': 'MoE-Weather-App',
            Accept: 'application/geo+json',
          },
        },
        2,
        10000
      );

      const stationsData = (await stationsResponse.json()) as { features?: Array<{ properties?: { stationIdentifier?: string } }> };
      const nearestStation = stationsData.features?.[0]?.properties?.stationIdentifier;

      if (!nearestStation) return undefined;

      // Get latest observation
      const obsResponse = await fetchWithRetry(
        `${this.config.baseUrl}/stations/${nearestStation}/observations/latest`,
        {
          headers: {
            'User-Agent': 'MoE-Weather-App',
            Accept: 'application/geo+json',
          },
        },
        2,
        10000
      );

      const obs = (await obsResponse.json()) as NWSObservationResponse;
      return this.parseObservation(obs);
    } catch {
      return undefined;
    }
  }

  private parseObservation(obs: NWSObservationResponse): CurrentWeather {
    const p = obs.properties;

    // Convert temperature from Celsius (NWS returns in C or F depending on unitCode)
    let temp = p.temperature.value;
    if (p.temperature.unitCode?.includes('degF')) {
      temp = (temp - 32) * (5 / 9);
    }

    // Convert wind speed from m/s or km/h
    let windSpeed = p.windSpeed.value || 0;
    if (p.windSpeed.unitCode?.includes('km_h')) {
      windSpeed = windSpeed / 3.6;
    }

    // Calculate cloud cover from cloud layers
    const cloudCover = this.calculateCloudCover(p.cloudLayers);

    return {
      temperature: temp,
      feelsLike: p.heatIndex?.value || p.windChill?.value || temp,
      humidity: p.relativeHumidity?.value || 0,
      pressure: (p.barometricPressure?.value || 101325) / 100, // Convert Pa to hPa
      windSpeed,
      windDirection: p.windDirection?.value || 0,
      windGust: p.windGust?.value ? p.windGust.value / 3.6 : undefined,
      visibility: p.visibility?.value || 10000,
      cloudCover,
      weatherCode: this.parseWeatherCode(p.textDescription),
      weatherDescription: p.textDescription || 'Unknown',
      timestamp: new Date(p.timestamp),
    };
  }

  private calculateCloudCover(
    layers: Array<{ base: { value: number }; amount: string }>
  ): number {
    if (!layers || layers.length === 0) return 0;

    const amounts: Record<string, number> = {
      CLR: 0,
      FEW: 18,
      SCT: 43,
      BKN: 75,
      OVC: 100,
    };

    // Return the highest cloud cover
    return Math.max(...layers.map((l) => amounts[l.amount] || 0));
  }

  private async fetchHourlyForecast(
    points: NWSPointsResponse,
    hours = 48
  ): Promise<HourlyForecast[]> {
    try {
      const response = await fetchWithRetry(
        points.properties.forecastHourly,
        {
          headers: {
            'User-Agent': 'MoE-Weather-App',
            Accept: 'application/geo+json',
          },
        },
        2,
        10000
      );

      const data = (await response.json()) as NWSForecastResponse;
      return this.parseHourlyForecast(data, hours);
    } catch {
      return [];
    }
  }

  private parseHourlyForecast(
    data: NWSForecastResponse,
    hours: number
  ): HourlyForecast[] {
    const periods = data.properties.periods.slice(0, hours);

    return periods.map((p) => {
      // Parse wind speed from string like "10 mph"
      const windMatch = p.windSpeed.match(/(\d+)/);
      const windSpeed = windMatch ? parseInt(windMatch[1]) * 0.44704 : 0; // mph to m/s

      // Parse temperature (convert if Fahrenheit)
      let temp = p.temperature;
      if (p.temperatureUnit === 'F') {
        temp = (temp - 32) * (5 / 9);
      }

      return {
        time: new Date(p.startTime),
        temperature: temp,
        feelsLike: temp, // NWS doesn't provide feels like in hourly
        humidity: p.relativeHumidity?.value || 0,
        pressure: 0, // Not provided in hourly forecast
        windSpeed,
        windDirection: this.parseWindDirection(p.windDirection),
        precipitation: 0, // Not provided as amount
        precipitationProbability: p.probabilityOfPrecipitation?.value || 0,
        weatherCode: this.parseWeatherCode(p.shortForecast),
        weatherDescription: p.shortForecast,
        cloudCover: this.estimateCloudCover(p.shortForecast),
      };
    });
  }

  private async fetchDailyForecast(
    points: NWSPointsResponse,
    days = 7
  ): Promise<DailyForecast[]> {
    try {
      const response = await fetchWithRetry(
        points.properties.forecast,
        {
          headers: {
            'User-Agent': 'MoE-Weather-App',
            Accept: 'application/geo+json',
          },
        },
        2,
        10000
      );

      const data = (await response.json()) as NWSForecastResponse;
      return this.parseDailyForecast(data, days);
    } catch {
      return [];
    }
  }

  private parseDailyForecast(
    data: NWSForecastResponse,
    days: number
  ): DailyForecast[] {
    const periods = data.properties.periods;
    const dailyForecasts: DailyForecast[] = [];

    // NWS returns day/night pairs, so we combine them
    for (let i = 0; i < periods.length && dailyForecasts.length < days; i += 2) {
      const day = periods[i];
      const night = periods[i + 1];

      if (!day) continue;

      const windMatch = day.windSpeed.match(/(\d+)/);
      const windSpeed = windMatch ? parseInt(windMatch[1]) * 0.44704 : 0;

      let tempMax = day.temperature;
      let tempMin = night?.temperature || day.temperature - 10;

      // Convert if Fahrenheit
      if (day.temperatureUnit === 'F') {
        tempMax = (tempMax - 32) * (5 / 9);
        tempMin = (tempMin - 32) * (5 / 9);
      }

      dailyForecasts.push({
        date: new Date(day.startTime),
        temperatureMax: tempMax,
        temperatureMin: tempMin,
        humidity: day.relativeHumidity?.value || 0,
        pressure: 0,
        windSpeed,
        windDirection: this.parseWindDirection(day.windDirection),
        precipitation: 0,
        precipitationProbability: day.probabilityOfPrecipitation?.value || 0,
        weatherCode: this.parseWeatherCode(day.shortForecast),
        weatherDescription: day.shortForecast,
        sunrise: new Date(day.startTime), // Approximate
        sunset: new Date(day.endTime), // Approximate
      });
    }

    return dailyForecasts;
  }

  private async fetchAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
    try {
      const response = await fetchWithRetry(
        `${this.config.baseUrl}/alerts/active?point=${lat},${lon}`,
        {
          headers: {
            'User-Agent': 'MoE-Weather-App',
            Accept: 'application/geo+json',
          },
        },
        2,
        10000
      );

      const data = (await response.json()) as NWSAlertsResponse;
      return data.features.map((f) => this.parseAlert(f.properties));
    } catch {
      return [];
    }
  }

  private parseAlert(props: NWSAlertsResponse['features'][0]['properties']): WeatherAlert {
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
      id: props.id,
      event: props.event,
      headline: props.headline || props.event,
      description: props.description,
      severity: severityMap[props.severity] || 'moderate',
      urgency: urgencyMap[props.urgency] || 'unknown',
      start: new Date(props.onset || props.effective),
      end: new Date(props.ends || props.expires),
      source: 'NWS',
    };
  }

  private parseWindDirection(direction: string): number {
    const directions: Record<string, number> = {
      N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
      E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
      S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
      W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
    };
    return directions[direction] || 0;
  }

  private parseWeatherCode(description: string): WeatherCode {
    const desc = description.toLowerCase();

    if (desc.includes('thunder')) return 95;
    if (desc.includes('heavy rain') || desc.includes('heavy showers')) return 65;
    if (desc.includes('rain') || desc.includes('showers')) return 61;
    if (desc.includes('heavy snow') || desc.includes('blizzard')) return 75;
    if (desc.includes('snow')) return 71;
    if (desc.includes('fog')) return 45;
    if (desc.includes('cloudy') || desc.includes('overcast')) return 3;
    if (desc.includes('partly')) return 2;
    if (desc.includes('mostly clear')) return 1;
    if (desc.includes('clear') || desc.includes('sunny')) return 0;

    return -1;
  }

  private estimateCloudCover(description: string): number {
    const desc = description.toLowerCase();

    if (desc.includes('clear') || desc.includes('sunny')) return 0;
    if (desc.includes('mostly clear') || desc.includes('mostly sunny')) return 15;
    if (desc.includes('partly')) return 50;
    if (desc.includes('mostly cloudy')) return 75;
    if (desc.includes('cloudy') || desc.includes('overcast')) return 100;

    return 50;
  }

  private isUSLocation(lat: number, lon: number): boolean {
    // Rough bounding box for US (including Alaska, Hawaii, and territories)
    // Continental US: lat 24-49, lon -125 to -66
    // Alaska: lat 51-72, lon -180 to -130
    // Hawaii: lat 18-29, lon -161 to -154
    // Puerto Rico: lat 17-19, lon -68 to -65
    // Guam: lat 13-14, lon 144-145

    const isContiguous = lat >= 24 && lat <= 49 && lon >= -125 && lon <= -66;
    const isAlaska = lat >= 51 && lat <= 72 && lon >= -180 && lon <= -130;
    const isHawaii = lat >= 18 && lat <= 29 && lon >= -161 && lon <= -154;
    const isPuertoRico = lat >= 17 && lat <= 19 && lon >= -68 && lon <= -65;
    const isGuam = lat >= 13 && lat <= 14 && lon >= 144 && lon <= 146;

    return isContiguous || isAlaska || isHawaii || isPuertoRico || isGuam;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check a known US location
      const response = await fetchWithRetry(
        `${this.config.baseUrl}/points/40.7128,-74.0060`,
        {
          headers: {
            'User-Agent': 'MoE-Weather-App',
            Accept: 'application/geo+json',
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
    return 0.25;
  }

  getConditionWeights(): Record<string, number> {
    return {
      temperature: 0.25,
      precipitation: 0.30,
      wind: 0.25,
      humidity: 0.20,
      uvIndex: 0.20,
      alerts: 0.45, // NWS is the authoritative source for US alerts
    };
  }
}
