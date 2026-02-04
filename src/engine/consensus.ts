/**
 * MoE Consensus Engine
 * Aggregates weather data from multiple sources using weighted averaging
 * and outlier detection for maximum accuracy
 */

import type {
  WeatherProvider,
  CurrentWeather,
  HourlyForecast,
  DailyForecast,
  WeatherAlert,
  ConfidenceScore,
  SourceInfo,
  WeatherCode,
} from '../types/weather.js';
import { getWeatherDescription } from '../types/weather.js';
import type { AdapterResponse } from '../adapters/base.js';

export interface ConsensusConfig {
  // Outlier detection threshold (IQR multiplier)
  outlierThreshold: number;
  // Minimum number of sources required for consensus
  minSources: number;
  // Weight decay for older data
  freshnessDecayMinutes: number;
  // Enable/disable outlier removal
  removeOutliers: boolean;
}

export interface ConsensusResult<T> {
  data: T;
  confidence: number;
  sources: SourceInfo[];
  outliers: WeatherProvider[];
}

interface WeightedValue {
  value: number;
  weight: number;
  provider: WeatherProvider;
}

const DEFAULT_CONFIG: ConsensusConfig = {
  outlierThreshold: 1.5,
  minSources: 2,
  freshnessDecayMinutes: 60,
  removeOutliers: true,
};

export class ConsensusEngine {
  private config: ConsensusConfig;
  private providerWeights: Map<WeatherProvider, Record<string, number>>;

  constructor(config: Partial<ConsensusConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.providerWeights = new Map();
    this.initializeDefaultWeights();
  }

  private initializeDefaultWeights(): void {
    // Default weights based on historical accuracy studies
    this.providerWeights.set('open-meteo', {
      temperature: 0.30,
      precipitation: 0.25,
      wind: 0.30,
      humidity: 0.30,
      pressure: 0.30,
      uvIndex: 0.25,
      cloudCover: 0.25,
      visibility: 0.20,
    });

    this.providerWeights.set('nws', {
      temperature: 0.25,
      precipitation: 0.30,
      wind: 0.25,
      humidity: 0.20,
      pressure: 0.25,
      uvIndex: 0.20,
      cloudCover: 0.20,
      visibility: 0.25,
    });

    this.providerWeights.set('openweathermap', {
      temperature: 0.20,
      precipitation: 0.20,
      wind: 0.20,
      humidity: 0.25,
      pressure: 0.20,
      uvIndex: 0.15,
      cloudCover: 0.25,
      visibility: 0.25,
    });

    this.providerWeights.set('weatherapi', {
      temperature: 0.15,
      precipitation: 0.15,
      wind: 0.15,
      humidity: 0.15,
      pressure: 0.15,
      uvIndex: 0.25,
      cloudCover: 0.20,
      visibility: 0.20,
    });

    this.providerWeights.set('tomorrow-io', {
      temperature: 0.10,
      precipitation: 0.10,
      wind: 0.10,
      humidity: 0.10,
      pressure: 0.10,
      uvIndex: 0.15,
      cloudCover: 0.10,
      visibility: 0.10,
    });
  }

  /**
   * Update weights for a specific provider
   */
  updateProviderWeights(
    provider: WeatherProvider,
    weights: Record<string, number>
  ): void {
    const existing = this.providerWeights.get(provider) || {};
    this.providerWeights.set(provider, { ...existing, ...weights });
  }

  /**
   * Get weight for a specific metric from a provider
   */
  private getWeight(provider: WeatherProvider, metric: string): number {
    const weights = this.providerWeights.get(provider);
    return weights?.[metric] ?? 0.1;
  }

  /**
   * Calculate freshness weight based on data age
   */
  private calculateFreshnessWeight(timestamp: Date): number {
    const ageMinutes = (Date.now() - timestamp.getTime()) / 60000;
    const decay = Math.max(
      0,
      1 - ageMinutes / this.config.freshnessDecayMinutes
    );
    return Math.max(0.1, decay); // Minimum weight of 0.1
  }

  /**
   * Detect and remove outliers using IQR method
   */
  private detectOutliers(values: WeightedValue[]): {
    filtered: WeightedValue[];
    outliers: WeatherProvider[];
  } {
    if (values.length < 3 || !this.config.removeOutliers) {
      return { filtered: values, outliers: [] };
    }

    const numericValues = values.map((v) => v.value).sort((a, b) => a - b);
    const q1 = numericValues[Math.floor(numericValues.length * 0.25)];
    const q3 = numericValues[Math.floor(numericValues.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - this.config.outlierThreshold * iqr;
    const upperBound = q3 + this.config.outlierThreshold * iqr;

    const outliers: WeatherProvider[] = [];
    const filtered = values.filter((v) => {
      const isOutlier = v.value < lowerBound || v.value > upperBound;
      if (isOutlier) {
        outliers.push(v.provider);
      }
      return !isOutlier;
    });

    return { filtered, outliers };
  }

  /**
   * Calculate weighted average of values
   */
  private weightedAverage(values: WeightedValue[]): number {
    if (values.length === 0) return 0;

    const totalWeight = values.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight === 0) return values[0].value;

    return values.reduce((sum, v) => sum + v.value * v.weight, 0) / totalWeight;
  }

  /**
   * Calculate confidence score based on source agreement
   */
  private calculateConfidence(
    values: WeightedValue[],
    finalValue: number
  ): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return 0.5;

    // Calculate coefficient of variation
    const mean = values.reduce((sum, v) => sum + v.value, 0) / values.length;
    if (mean === 0) return 1;

    const variance =
      values.reduce((sum, v) => sum + Math.pow(v.value - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);
    const cv = Math.abs(stdDev / mean);

    // Convert CV to confidence (lower CV = higher confidence)
    // CV of 0 = confidence 1, CV of 0.5+ = confidence ~0.5
    const confidence = Math.max(0.3, 1 - cv);

    return Math.min(1, confidence);
  }

  /**
   * Aggregate current weather from multiple sources
   */
  aggregateCurrentWeather(
    responses: Array<{
      provider: WeatherProvider;
      data: AdapterResponse;
      timestamp: Date;
    }>
  ): ConsensusResult<CurrentWeather> | null {
    const validResponses = responses.filter((r) => r.data.current);

    if (validResponses.length === 0) {
      return null;
    }

    if (validResponses.length === 1) {
      const r = validResponses[0];
      return {
        data: r.data.current!,
        confidence: 0.5,
        sources: [
          {
            name: r.provider,
            weight: 1,
            responseTime: r.data.raw.responseTime,
            dataFreshness: r.data.raw.fetchedAt,
          },
        ],
        outliers: [],
      };
    }

    // Collect values for each metric
    const metrics = {
      temperature: [] as WeightedValue[],
      feelsLike: [] as WeightedValue[],
      humidity: [] as WeightedValue[],
      pressure: [] as WeightedValue[],
      windSpeed: [] as WeightedValue[],
      windDirection: [] as WeightedValue[],
      windGust: [] as WeightedValue[],
      visibility: [] as WeightedValue[],
      cloudCover: [] as WeightedValue[],
      precipitation: [] as WeightedValue[],
      uvIndex: [] as WeightedValue[],
    };

    const weatherCodes: Array<{ code: WeatherCode; weight: number }> = [];
    const sources: SourceInfo[] = [];
    const allOutliers: Set<WeatherProvider> = new Set();

    for (const response of validResponses) {
      const current = response.data.current!;
      const freshnessWeight = this.calculateFreshnessWeight(response.timestamp);

      // Add source info
      sources.push({
        name: response.provider,
        weight: this.getWeight(response.provider, 'temperature'),
        responseTime: response.data.raw.responseTime,
        dataFreshness: response.data.raw.fetchedAt,
      });

      // Collect all metric values
      const addMetric = (
        metric: keyof typeof metrics,
        value: number | undefined
      ) => {
        if (value !== undefined && !isNaN(value)) {
          const weight =
            this.getWeight(response.provider, metric) * freshnessWeight;
          metrics[metric].push({
            value,
            weight,
            provider: response.provider,
          });
        }
      };

      addMetric('temperature', current.temperature);
      addMetric('feelsLike', current.feelsLike);
      addMetric('humidity', current.humidity);
      addMetric('pressure', current.pressure);
      addMetric('windSpeed', current.windSpeed);
      addMetric('windDirection', current.windDirection);
      addMetric('windGust', current.windGust);
      addMetric('visibility', current.visibility);
      addMetric('cloudCover', current.cloudCover);
      addMetric('precipitation', current.precipitation);
      addMetric('uvIndex', current.uvIndex);

      weatherCodes.push({
        code: current.weatherCode,
        weight: this.getWeight(response.provider, 'temperature') * freshnessWeight,
      });
    }

    // Process each metric
    const processMetric = (values: WeightedValue[]): number => {
      const { filtered, outliers } = this.detectOutliers(values);
      outliers.forEach((o) => allOutliers.add(o));
      return this.weightedAverage(filtered);
    };

    const temperature = processMetric(metrics.temperature);

    // Determine weather code by weighted voting
    const weatherCode = this.determineWeatherCode(weatherCodes);

    const result: CurrentWeather = {
      temperature,
      feelsLike: processMetric(metrics.feelsLike),
      humidity: Math.round(processMetric(metrics.humidity)),
      pressure: Math.round(processMetric(metrics.pressure)),
      windSpeed: processMetric(metrics.windSpeed),
      windDirection: Math.round(processMetric(metrics.windDirection)),
      windGust:
        metrics.windGust.length > 0
          ? processMetric(metrics.windGust)
          : undefined,
      visibility: Math.round(processMetric(metrics.visibility)),
      cloudCover: Math.round(processMetric(metrics.cloudCover)),
      precipitation:
        metrics.precipitation.length > 0
          ? processMetric(metrics.precipitation)
          : undefined,
      uvIndex:
        metrics.uvIndex.length > 0
          ? Math.round(processMetric(metrics.uvIndex))
          : undefined,
      weatherCode,
      weatherDescription: getWeatherDescription(weatherCode),
      timestamp: new Date(),
    };

    const confidence = this.calculateConfidence(metrics.temperature, temperature);

    return {
      data: result,
      confidence,
      sources,
      outliers: Array.from(allOutliers),
    };
  }

  /**
   * Determine weather code by weighted voting
   */
  private determineWeatherCode(
    votes: Array<{ code: WeatherCode; weight: number }>
  ): WeatherCode {
    if (votes.length === 0) return -1 as WeatherCode;

    // Group by code and sum weights
    const codeWeights = new Map<WeatherCode, number>();
    for (const vote of votes) {
      const existing = codeWeights.get(vote.code) || 0;
      codeWeights.set(vote.code, existing + vote.weight);
    }

    // Find code with highest total weight
    let maxWeight = 0;
    let bestCode: WeatherCode = votes[0].code;

    for (const [code, weight] of codeWeights) {
      if (weight > maxWeight) {
        maxWeight = weight;
        bestCode = code;
      }
    }

    return bestCode;
  }

  /**
   * Aggregate hourly forecasts from multiple sources
   */
  aggregateHourlyForecast(
    responses: Array<{
      provider: WeatherProvider;
      data: AdapterResponse;
      timestamp: Date;
    }>,
    hours = 48
  ): HourlyForecast[] {
    const validResponses = responses.filter(
      (r) => r.data.hourly && r.data.hourly.length > 0
    );

    if (validResponses.length === 0) return [];

    // Group forecasts by hour
    const hourlyMap = new Map<string, Array<{
      provider: WeatherProvider;
      forecast: HourlyForecast;
      freshnessWeight: number;
    }>>();

    for (const response of validResponses) {
      const freshnessWeight = this.calculateFreshnessWeight(response.timestamp);

      for (const forecast of response.data.hourly!.slice(0, hours)) {
        const hourKey = this.getHourKey(forecast.time);

        if (!hourlyMap.has(hourKey)) {
          hourlyMap.set(hourKey, []);
        }

        hourlyMap.get(hourKey)!.push({
          provider: response.provider,
          forecast,
          freshnessWeight,
        });
      }
    }

    // Aggregate each hour
    const results: HourlyForecast[] = [];

    for (const [hourKey, forecasts] of hourlyMap) {
      if (results.length >= hours) break;

      const aggregated = this.aggregateSingleHour(forecasts);
      if (aggregated) {
        results.push(aggregated);
      }
    }

    // Sort by time
    return results.sort((a, b) => a.time.getTime() - b.time.getTime());
  }

  private getHourKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
  }

  private aggregateSingleHour(
    forecasts: Array<{
      provider: WeatherProvider;
      forecast: HourlyForecast;
      freshnessWeight: number;
    }>
  ): HourlyForecast | null {
    if (forecasts.length === 0) return null;

    const collectValues = (
      getter: (f: HourlyForecast) => number | undefined,
      metric: string
    ): WeightedValue[] => {
      return forecasts
        .map((f) => {
          const value = getter(f.forecast);
          if (value === undefined || isNaN(value)) return null;
          return {
            value,
            weight: this.getWeight(f.provider, metric) * f.freshnessWeight,
            provider: f.provider,
          };
        })
        .filter((v): v is WeightedValue => v !== null);
    };

    const processValues = (values: WeightedValue[]): number => {
      if (values.length === 0) return 0;
      const { filtered } = this.detectOutliers(values);
      return this.weightedAverage(filtered);
    };

    const weatherCodes = forecasts.map((f) => ({
      code: f.forecast.weatherCode,
      weight: this.getWeight(f.provider, 'temperature') * f.freshnessWeight,
    }));

    return {
      time: forecasts[0].forecast.time,
      temperature: processValues(
        collectValues((f) => f.temperature, 'temperature')
      ),
      feelsLike: processValues(collectValues((f) => f.feelsLike, 'temperature')),
      humidity: Math.round(
        processValues(collectValues((f) => f.humidity, 'humidity'))
      ),
      pressure: Math.round(
        processValues(collectValues((f) => f.pressure, 'pressure'))
      ),
      windSpeed: processValues(collectValues((f) => f.windSpeed, 'wind')),
      windDirection: Math.round(
        processValues(collectValues((f) => f.windDirection, 'wind'))
      ),
      precipitation: processValues(
        collectValues((f) => f.precipitation, 'precipitation')
      ),
      precipitationProbability: Math.round(
        processValues(
          collectValues((f) => f.precipitationProbability, 'precipitation')
        )
      ),
      weatherCode: this.determineWeatherCode(weatherCodes),
      weatherDescription: getWeatherDescription(
        this.determineWeatherCode(weatherCodes)
      ),
      cloudCover: Math.round(
        processValues(collectValues((f) => f.cloudCover, 'cloudCover'))
      ),
      uvIndex: processValues(collectValues((f) => f.uvIndex, 'uvIndex')) || undefined,
    };
  }

  /**
   * Aggregate daily forecasts from multiple sources
   */
  aggregateDailyForecast(
    responses: Array<{
      provider: WeatherProvider;
      data: AdapterResponse;
      timestamp: Date;
    }>,
    days = 7
  ): DailyForecast[] {
    const validResponses = responses.filter(
      (r) => r.data.daily && r.data.daily.length > 0
    );

    if (validResponses.length === 0) return [];

    // Group forecasts by day
    const dailyMap = new Map<string, Array<{
      provider: WeatherProvider;
      forecast: DailyForecast;
      freshnessWeight: number;
    }>>();

    for (const response of validResponses) {
      const freshnessWeight = this.calculateFreshnessWeight(response.timestamp);

      for (const forecast of response.data.daily!.slice(0, days)) {
        const dayKey = forecast.date.toISOString().split('T')[0];

        if (!dailyMap.has(dayKey)) {
          dailyMap.set(dayKey, []);
        }

        dailyMap.get(dayKey)!.push({
          provider: response.provider,
          forecast,
          freshnessWeight,
        });
      }
    }

    // Aggregate each day
    const results: DailyForecast[] = [];

    for (const [, forecasts] of dailyMap) {
      if (results.length >= days) break;

      const aggregated = this.aggregateSingleDay(forecasts);
      if (aggregated) {
        results.push(aggregated);
      }
    }

    // Sort by date
    return results.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private aggregateSingleDay(
    forecasts: Array<{
      provider: WeatherProvider;
      forecast: DailyForecast;
      freshnessWeight: number;
    }>
  ): DailyForecast | null {
    if (forecasts.length === 0) return null;

    const collectValues = (
      getter: (f: DailyForecast) => number | undefined,
      metric: string
    ): WeightedValue[] => {
      return forecasts
        .map((f) => {
          const value = getter(f.forecast);
          if (value === undefined || isNaN(value)) return null;
          return {
            value,
            weight: this.getWeight(f.provider, metric) * f.freshnessWeight,
            provider: f.provider,
          };
        })
        .filter((v): v is WeightedValue => v !== null);
    };

    const processValues = (values: WeightedValue[]): number => {
      if (values.length === 0) return 0;
      const { filtered } = this.detectOutliers(values);
      return this.weightedAverage(filtered);
    };

    const weatherCodes = forecasts.map((f) => ({
      code: f.forecast.weatherCode,
      weight: this.getWeight(f.provider, 'temperature') * f.freshnessWeight,
    }));

    // Get earliest sunrise and latest sunset for safety
    const sunrises = forecasts
      .map((f) => f.forecast.sunrise)
      .filter((d) => d)
      .sort((a, b) => a.getTime() - b.getTime());
    const sunsets = forecasts
      .map((f) => f.forecast.sunset)
      .filter((d) => d)
      .sort((a, b) => b.getTime() - a.getTime());

    return {
      date: forecasts[0].forecast.date,
      temperatureMax: processValues(
        collectValues((f) => f.temperatureMax, 'temperature')
      ),
      temperatureMin: processValues(
        collectValues((f) => f.temperatureMin, 'temperature')
      ),
      humidity: Math.round(
        processValues(collectValues((f) => f.humidity, 'humidity'))
      ),
      pressure: Math.round(
        processValues(collectValues((f) => f.pressure, 'pressure'))
      ),
      windSpeed: processValues(collectValues((f) => f.windSpeed, 'wind')),
      windDirection: Math.round(
        processValues(collectValues((f) => f.windDirection, 'wind'))
      ),
      precipitation: processValues(
        collectValues((f) => f.precipitation, 'precipitation')
      ),
      precipitationProbability: Math.round(
        processValues(
          collectValues((f) => f.precipitationProbability, 'precipitation')
        )
      ),
      weatherCode: this.determineWeatherCode(weatherCodes),
      weatherDescription: getWeatherDescription(
        this.determineWeatherCode(weatherCodes)
      ),
      sunrise: sunrises[0] || forecasts[0].forecast.sunrise,
      sunset: sunsets[0] || forecasts[0].forecast.sunset,
      uvIndex: processValues(collectValues((f) => f.uvIndex, 'uvIndex')) || undefined,
    };
  }

  /**
   * Merge alerts from all sources, deduplicating by event type
   */
  mergeAlerts(
    responses: Array<{
      provider: WeatherProvider;
      data: AdapterResponse;
    }>
  ): WeatherAlert[] {
    const alertMap = new Map<string, WeatherAlert>();

    for (const response of responses) {
      if (!response.data.alerts) continue;

      for (const alert of response.data.alerts) {
        // Use event + time range as key for deduplication
        const key = `${alert.event}-${alert.start.toISOString()}-${alert.end.toISOString()}`;

        if (!alertMap.has(key)) {
          alertMap.set(key, alert);
        } else {
          // Keep the one with higher severity
          const existing = alertMap.get(key)!;
          const severityOrder = ['minor', 'moderate', 'severe', 'extreme'];
          if (
            severityOrder.indexOf(alert.severity) >
            severityOrder.indexOf(existing.severity)
          ) {
            alertMap.set(key, alert);
          }
        }
      }
    }

    // Sort by severity (most severe first) then by start time
    return Array.from(alertMap.values()).sort((a, b) => {
      const severityOrder = ['extreme', 'severe', 'moderate', 'minor'];
      const severityDiff =
        severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      if (severityDiff !== 0) return severityDiff;
      return a.start.getTime() - b.start.getTime();
    });
  }

  /**
   * Calculate overall confidence score
   */
  calculateOverallConfidence(
    temperatureConfidence: number,
    precipitationConfidence: number,
    windConfidence: number,
    sourceCount: number
  ): ConfidenceScore {
    // Agreement bonus for having multiple sources
    const agreementBonus = Math.min(0.2, (sourceCount - 1) * 0.1);

    return {
      overall:
        (temperatureConfidence * 0.4 +
          precipitationConfidence * 0.3 +
          windConfidence * 0.3 +
          agreementBonus) /
        1.2,
      temperature: temperatureConfidence,
      precipitation: precipitationConfidence,
      wind: windConfidence,
      agreement: Math.min(1, sourceCount / 3),
    };
  }
}
