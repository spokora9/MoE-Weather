/**
 * Base Weather API Adapter
 * All weather API adapters extend this class
 */

import type {
  WeatherProvider,
  WeatherRequest,
  CurrentWeather,
  HourlyForecast,
  DailyForecast,
  WeatherAlert,
  RawWeatherResponse,
} from '../types/weather.js';

export interface AdapterConfig {
  apiKey?: string;
  baseUrl: string;
  timeout: number;
  retries: number;
}

export interface AdapterResponse {
  current?: CurrentWeather;
  hourly?: HourlyForecast[];
  daily?: DailyForecast[];
  alerts?: WeatherAlert[];
  raw: RawWeatherResponse;
}

export interface QuotaInfo {
  limit: number;
  used: number;
  resetAt: Date;
  type: 'daily' | 'monthly' | 'unlimited';
}

export abstract class WeatherAdapter {
  protected config: AdapterConfig;
  protected provider: WeatherProvider;
  protected quota: QuotaInfo;

  constructor(provider: WeatherProvider, config: AdapterConfig) {
    this.provider = provider;
    this.config = config;
    this.quota = {
      limit: Infinity,
      used: 0,
      resetAt: new Date(),
      type: 'unlimited',
    };
  }

  /**
   * Get the provider name
   */
  getProvider(): WeatherProvider {
    return this.provider;
  }

  /**
   * Check if the adapter has available quota
   */
  hasQuota(): boolean {
    if (this.quota.type === 'unlimited') return true;

    // Reset quota if needed
    if (new Date() > this.quota.resetAt) {
      this.quota.used = 0;
      this.quota.resetAt = this.getNextResetTime();
    }

    return this.quota.used < this.quota.limit;
  }

  /**
   * Get remaining quota percentage (0-1)
   */
  getQuotaPercentage(): number {
    if (this.quota.type === 'unlimited') return 1;
    return Math.max(0, (this.quota.limit - this.quota.used) / this.quota.limit);
  }

  /**
   * Increment quota usage
   */
  protected incrementQuota(): void {
    this.quota.used++;
  }

  /**
   * Get the next quota reset time
   */
  protected getNextResetTime(): Date {
    const now = new Date();
    if (this.quota.type === 'daily') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (this.quota.type === 'monthly') {
      return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    return new Date(now.getTime() + 86400000); // Default: 24 hours
  }

  /**
   * Fetch weather data from the API
   */
  abstract fetch(request: WeatherRequest): Promise<AdapterResponse>;

  /**
   * Check if the API is healthy/available
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get the base weight for this provider (used in consensus)
   */
  abstract getBaseWeight(): number;

  /**
   * Get weights for specific weather conditions
   */
  getConditionWeights(): Record<string, number> {
    const base = this.getBaseWeight();
    return {
      temperature: base,
      precipitation: base,
      wind: base,
      humidity: base,
      uvIndex: base,
      alerts: base,
    };
  }
}

/**
 * Utility function to make HTTP requests with retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt < retries - 1) {
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }

  clearTimeout(timeoutId);
  throw lastError || new Error('Failed to fetch after retries');
}
