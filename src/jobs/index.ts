import { CacheWarmer } from './cache-warmer.js';
import { AlertPusher } from './alert-pusher.js';
import { createLogger } from '../lib/logger.js';
import type { WeatherData } from '../types/weather.js';

const logger = createLogger('jobs');

let cacheWarmer: CacheWarmer | null = null;
let alertPusher: AlertPusher | null = null;

type GetWeatherFn = (req: { latitude: number; longitude: number }) => Promise<unknown>;

export function startJobs(getWeather: GetWeatherFn): void {
  logger.info('Starting background jobs');
  cacheWarmer = new CacheWarmer(getWeather);
  cacheWarmer.start();

  // The orchestrator returns WeatherData; the loose GetWeatherFn alias above
  // exists for cache-warmer which doesn't inspect the result.
  alertPusher = new AlertPusher(
    getWeather as (req: { latitude: number; longitude: number }) => Promise<WeatherData>,
  );
  alertPusher.start();
}

export function stopJobs(): void {
  cacheWarmer?.stop();
  cacheWarmer = null;
  alertPusher?.stop();
  alertPusher = null;
}
