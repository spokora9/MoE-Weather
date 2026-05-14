/**
 * MoE Weather Orchestrator
 * Coordinates API requests, caching, and consensus building
 */

import type {
  WeatherRequest,
  WeatherData,
  WeatherProvider,
  Location,
  GeocodingResult,
} from '../types/weather.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('orchestrator');
import {
  WeatherAdapter,
  OpenMeteoAdapter,
  NWSAdapter,
  OpenWeatherMapAdapter,
  WeatherAPIAdapter,
  BrightSkyAdapter,
  MetNorwayAdapter,
  type AdapterResponse,
} from '../adapters/index.js';
import { ConsensusEngine, type ConsensusConfig } from './consensus.js';
import { CacheManager, type CacheConfig } from './cache.js';

export interface OrchestratorConfig {
  // API Keys (optional - some APIs don't need keys)
  apiKeys?: {
    openWeatherMap?: string;
    weatherApi?: string;
    tomorrowIo?: string;
  };
  // Consensus configuration
  consensus?: Partial<ConsensusConfig>;
  // Cache configuration
  cache?: Partial<CacheConfig>;
  // Request timeout in ms
  timeout?: number;
  // Enable/disable specific providers
  enabledProviders?: WeatherProvider[];
  // Minimum providers to query (for consensus)
  minProviders?: number;
  // Maximum concurrent requests
  maxConcurrent?: number;
}

interface ProviderHealth {
  provider: WeatherProvider;
  healthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
}

export class WeatherOrchestrator {
  private adapters: Map<WeatherProvider, WeatherAdapter>;
  private consensus: ConsensusEngine;
  private cache: CacheManager;
  private config: Required<OrchestratorConfig>;
  private healthStatus: Map<WeatherProvider, ProviderHealth>;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      apiKeys: config.apiKeys || {},
      consensus: config.consensus || {},
      cache: config.cache || {},
      timeout: config.timeout || 15000,
      enabledProviders: config.enabledProviders || [
        'open-meteo',
        'nws',
        'openweathermap',
        'weatherapi',
      ],
      minProviders: config.minProviders || 2,
      maxConcurrent: config.maxConcurrent || 5,
    };

    this.adapters = new Map();
    this.consensus = new ConsensusEngine(this.config.consensus);
    this.cache = new CacheManager(this.config.cache);
    this.healthStatus = new Map();

    this.initializeAdapters();
  }

  // Regional adapters for location-based routing (free, no key needed)
  private regionalAdapters: {
    brightSky: BrightSkyAdapter;
    metNorway: MetNorwayAdapter;
  } | null = null;

  private initializeAdapters(): void {
    const { enabledProviders, apiKeys } = this.config;

    // === GLOBAL PROVIDERS (work everywhere) ===

    // Open-Meteo: Primary global source (free, no key needed)
    // Aggregates: ECMWF, GFS, DWD ICON, MeteoFrance, JMA, MET Norway, GEM, UKMO
    if (enabledProviders.includes('open-meteo')) {
      this.adapters.set('open-meteo', new OpenMeteoAdapter());
      this.initHealthStatus('open-meteo');
    }

    // OpenWeatherMap: Global coverage (requires key)
    if (enabledProviders.includes('openweathermap') && apiKeys.openWeatherMap) {
      this.adapters.set(
        'openweathermap',
        new OpenWeatherMapAdapter(apiKeys.openWeatherMap)
      );
      this.initHealthStatus('openweathermap');
    }

    // WeatherAPI: Global coverage (requires key)
    if (enabledProviders.includes('weatherapi') && apiKeys.weatherApi) {
      this.adapters.set(
        'weatherapi',
        new WeatherAPIAdapter(apiKeys.weatherApi)
      );
      this.initHealthStatus('weatherapi');
    }

    // === REGIONAL PROVIDERS (free, no key, best for specific regions) ===

    // NWS: US only (official government source)
    if (enabledProviders.includes('nws')) {
      this.adapters.set('nws', new NWSAdapter());
      this.initHealthStatus('nws');
    }

    // Initialize regional adapters (always available, location-filtered)
    this.regionalAdapters = {
      brightSky: new BrightSkyAdapter(),  // Germany/Central Europe
      metNorway: new MetNorwayAdapter(),  // Nordic countries
    };

    logger.info(
      { providers: Array.from(this.adapters.keys()), count: this.adapters.size },
      'Weather providers initialized'
    );
    logger.info('Regional providers available: Bright Sky (Germany/EU), MET Norway (Nordic)');
  }

  private initHealthStatus(provider: WeatherProvider): void {
    this.healthStatus.set(provider, {
      provider,
      healthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
    });
  }

  /**
   * Get weather data for a location
   */
  async getWeather(request: WeatherRequest): Promise<WeatherData> {
    const { latitude, longitude } = request;

    // Check cache first
    const cached = this.cache.get<WeatherData>(
      'current',
      latitude,
      longitude
    );
    if (cached) {
      logger.debug({ latitude, longitude }, 'Returning cached weather data');
      return cached;
    }

    // Determine which providers to query
    const providers = this.selectProviders(latitude, longitude);

    // Get regional adapters for this location
    const regionalAdapters = this.getRegionalAdapters(latitude, longitude);

    if (providers.length === 0 && regionalAdapters.length === 0) {
      throw new Error('No weather providers available');
    }

    logger.info({ providers }, 'Querying global weather providers');
    if (regionalAdapters.length > 0) {
      logger.info({ count: regionalAdapters.length }, 'Querying regional providers for enhanced accuracy');
    }

    // Fetch from all selected providers in parallel (global + regional)
    const results = await this.fetchFromAllProviders(providers, regionalAdapters, request);

    // Build consensus from results
    const weatherData = this.buildConsensus(results, request);

    // Cache the result
    this.cache.set('current', latitude, longitude, weatherData);

    return weatherData;
  }

  /**
   * Select which providers to query based on location and health
   * Uses smart regional routing for maximum accuracy
   */
  private selectProviders(lat: number, lon: number): WeatherProvider[] {
    const selected: WeatherProvider[] = [];

    // Always include Open-Meteo if available (unlimited, free, GLOBAL)
    // Open-Meteo aggregates: ECMWF, GFS, DWD ICON, MeteoFrance, JMA, MET Norway, GEM, UKMO
    if (this.isProviderAvailable('open-meteo')) {
      selected.push('open-meteo');
    }

    // REGIONAL ROUTING: Add best regional sources based on location

    // US locations: Add NWS (official US government source)
    if (this.isProviderAvailable('nws') && this.isUSLocation(lat, lon)) {
      selected.push('nws');
    }

    // Add global providers with API keys for additional consensus
    const additionalProviders: WeatherProvider[] = ['openweathermap', 'weatherapi', 'tomorrow-io'];

    for (const provider of additionalProviders) {
      if (selected.length >= this.config.maxConcurrent) break;
      if (this.isProviderAvailable(provider)) {
        selected.push(provider);
      }
    }

    return selected;
  }

  /**
   * Get regional adapters that should be queried for a location
   */
  private getRegionalAdapters(lat: number, lon: number): WeatherAdapter[] {
    const regional: WeatherAdapter[] = [];

    if (this.regionalAdapters) {
      // Germany/Central Europe: Bright Sky (DWD data)
      if (this.regionalAdapters.brightSky.isInCoverageArea(lat, lon)) {
        regional.push(this.regionalAdapters.brightSky);
      }

      // Nordic countries: MET Norway
      if (this.regionalAdapters.metNorway.isInCoverageArea(lat, lon)) {
        regional.push(this.regionalAdapters.metNorway);
      }
    }

    return regional;
  }

  /**
   * Check if a provider is available and healthy
   */
  private isProviderAvailable(provider: WeatherProvider): boolean {
    const adapter = this.adapters.get(provider);
    if (!adapter) return false;

    // Check health status
    const health = this.healthStatus.get(provider);
    if (health && !health.healthy && health.consecutiveFailures >= 3) {
      // Provider has failed multiple times, skip it for now
      // But check if it's been a while since last check
      const timeSinceLastCheck =
        Date.now() - health.lastCheck.getTime();
      if (timeSinceLastCheck < 300000) {
        // Less than 5 minutes
        return false;
      }
    }

    // Check quota
    return adapter.hasQuota();
  }

  /**
   * Fetch weather data from all providers (global + regional)
   */
  private async fetchFromAllProviders(
    globalProviders: WeatherProvider[],
    regionalAdapters: WeatherAdapter[],
    request: WeatherRequest
  ): Promise<
    Array<{
      provider: WeatherProvider;
      data: AdapterResponse;
      timestamp: Date;
    }>
  > {
    // Fetch from global providers
    const globalPromises = globalProviders.map(async (provider) => {
      const adapter = this.adapters.get(provider)!;
      return this.fetchFromAdapter(provider, adapter, request);
    });

    // Fetch from regional adapters
    const regionalPromises = regionalAdapters.map(async (adapter) => {
      const provider = adapter.getProvider();
      return this.fetchFromAdapter(provider, adapter, request);
    });

    const allPromises = [...globalPromises, ...regionalPromises];
    const results = await Promise.all(allPromises);

    return results.filter(
      (r): r is NonNullable<typeof r> => r !== null && r.data.current !== undefined
    );
  }

  /**
   * Fetch from a single adapter with timeout and error handling
   */
  private async fetchFromAdapter(
    provider: WeatherProvider,
    adapter: WeatherAdapter,
    request: WeatherRequest
  ): Promise<{
    provider: WeatherProvider;
    data: AdapterResponse;
    timestamp: Date;
  } | null> {
    const startTime = Date.now();

    try {
      const data = await Promise.race([
        adapter.fetch(request),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.config.timeout)
        ),
      ]);

      // Update health status on success
      this.updateHealthStatus(provider, true);

      logger.info(
        { provider, duration: Date.now() - startTime },
        'Provider responded'
      );

      return {
        provider,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(
        { provider, err: error },
        'Provider request failed'
      );
      this.updateHealthStatus(provider, false);
      return null;
    }
  }

  /**
   * Update provider health status
   */
  private updateHealthStatus(provider: WeatherProvider, success: boolean): void {
    const health = this.healthStatus.get(provider);
    if (!health) return;

    if (success) {
      health.healthy = true;
      health.consecutiveFailures = 0;
    } else {
      health.consecutiveFailures++;
      if (health.consecutiveFailures >= 3) {
        health.healthy = false;
      }
    }
    health.lastCheck = new Date();
  }

  /**
   * Build consensus weather data from multiple provider responses
   */
  private buildConsensus(
    results: Array<{
      provider: WeatherProvider;
      data: AdapterResponse;
      timestamp: Date;
    }>,
    request: WeatherRequest
  ): WeatherData {
    if (results.length === 0) {
      throw new Error('No weather data received from any provider');
    }

    // Aggregate current weather
    const currentResult = this.consensus.aggregateCurrentWeather(results);
    if (!currentResult) {
      throw new Error('Failed to aggregate current weather');
    }

    // Aggregate forecasts
    const hourly = this.consensus.aggregateHourlyForecast(
      results,
      request.hourlyHours || 48
    );
    const daily = this.consensus.aggregateDailyForecast(
      results,
      request.dailyDays || 7
    );

    // Merge alerts
    const alerts = this.consensus.mergeAlerts(results);

    // Calculate confidence
    const confidence = this.consensus.calculateOverallConfidence(
      currentResult.confidence,
      0.8, // Placeholder for precipitation confidence
      0.8, // Placeholder for wind confidence
      results.length
    );

    // Determine location info
    const location: Location = this.determineLocation(results, request);

    return {
      location,
      current: currentResult.data,
      hourly,
      daily,
      alerts,
      metadata: {
        sources: currentResult.sources,
        confidence,
        fetchedAt: new Date(),
        cacheExpiry: new Date(Date.now() + 300000), // 5 minutes
      },
    };
  }

  /**
   * Determine location info from responses
   */
  private determineLocation(
    results: Array<{
      provider: WeatherProvider;
      data: AdapterResponse;
    }>,
    request: WeatherRequest
  ): Location {
    // Try to get location from raw response data
    for (const result of results) {
      const raw = result.data.raw.data as Record<string, unknown>;
      if (raw && typeof raw === 'object') {
        // Open-Meteo format
        if ('latitude' in raw && 'longitude' in raw) {
          return {
            name: 'Unknown',
            country: 'Unknown',
            coordinates: {
              latitude: raw.latitude as number,
              longitude: raw.longitude as number,
            },
            timezone: (raw.timezone as string) || undefined,
          };
        }
        // OpenWeatherMap format
        if ('name' in raw && 'sys' in raw) {
          const sys = raw.sys as { country?: string };
          return {
            name: raw.name as string,
            country: sys.country || 'Unknown',
            coordinates: {
              latitude: request.latitude,
              longitude: request.longitude,
            },
          };
        }
      }
    }

    // Fallback to request coordinates
    return {
      name: 'Unknown',
      country: 'Unknown',
      coordinates: {
        latitude: request.latitude,
        longitude: request.longitude,
      },
    };
  }

  /**
   * Check if coordinates are in the US
   */
  private isUSLocation(lat: number, lon: number): boolean {
    const isContiguous = lat >= 24 && lat <= 49 && lon >= -125 && lon <= -66;
    const isAlaska = lat >= 51 && lat <= 72 && lon >= -180 && lon <= -130;
    const isHawaii = lat >= 18 && lat <= 29 && lon >= -161 && lon <= -154;
    return isContiguous || isAlaska || isHawaii;
  }

  /**
   * Geocode a location name to coordinates
   */
  async geocode(query: string): Promise<GeocodingResult[]> {
    // Check cache
    const cacheKey = query.toLowerCase().trim();
    const cached = this.cache.get<GeocodingResult[]>(
      'geocoding',
      0,
      0,
      cacheKey
    );
    if (cached) {
      return cached;
    }

    // Use Open-Meteo geocoding (free, no key needed)
    const params = new URLSearchParams({
      name: query,
      count: '10',
      language: 'en',
      format: 'json',
    });

    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?${params}`
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      results?: Array<{
        name: string;
        country: string;
        admin1?: string;
        latitude: number;
        longitude: number;
        population?: number;
      }>;
    };

    const results: GeocodingResult[] = (data.results || []).map((r) => ({
      name: r.name,
      country: r.country,
      state: r.admin1,
      latitude: r.latitude,
      longitude: r.longitude,
      population: r.population,
    }));

    // Cache results
    this.cache.set('geocoding', 0, 0, results, cacheKey);

    return results;
  }

  /**
   * Get provider health status
   */
  getHealthStatus(): Map<WeatherProvider, ProviderHealth> {
    return new Map(this.healthStatus);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Run health checks on all providers
   */
  async runHealthChecks(): Promise<Map<WeatherProvider, boolean>> {
    const results = new Map<WeatherProvider, boolean>();

    const checks = Array.from(this.adapters.entries()).map(
      async ([provider, adapter]) => {
        try {
          const healthy = await adapter.healthCheck();
          this.updateHealthStatus(provider, healthy);
          results.set(provider, healthy);
        } catch {
          this.updateHealthStatus(provider, false);
          results.set(provider, false);
        }
      }
    );

    await Promise.all(checks);
    return results;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.flush();
  }

  /**
   * Shutdown the orchestrator
   */
  shutdown(): void {
    this.cache.close();
  }
}
