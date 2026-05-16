import { CacheWarmer } from './cache-warmer.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('jobs');

let cacheWarmer: CacheWarmer | null = null;

type GetWeatherFn = (req: { latitude: number; longitude: number }) => Promise<unknown>;

export function startJobs(getWeather: GetWeatherFn): void {
  logger.info('Starting background jobs');
  cacheWarmer = new CacheWarmer(getWeather);
  cacheWarmer.start();
}

export function stopJobs(): void {
  cacheWarmer?.stop();
  cacheWarmer = null;
}
