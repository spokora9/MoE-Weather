import { createLogger } from '../lib/logger.js';
import type { WeatherRequest } from '../types/weather.js';

const logger = createLogger('cache-warmer');

// Top 50 global cities by population/usage
const TOP_CITIES: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { name: 'Chicago', lat: 41.85, lon: -87.65 },
  { name: 'Houston', lat: 29.76, lon: -95.37 },
  { name: 'Phoenix', lat: 33.45, lon: -112.07 },
  { name: 'Philadelphia', lat: 39.95, lon: -75.17 },
  { name: 'San Antonio', lat: 29.42, lon: -98.49 },
  { name: 'San Diego', lat: 32.72, lon: -117.16 },
  { name: 'Dallas', lat: 32.79, lon: -96.77 },
  { name: 'San Jose', lat: 37.34, lon: -121.89 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Paris', lat: 48.85, lon: 2.35 },
  { name: 'Berlin', lat: 52.52, lon: 13.40 },
  { name: 'Madrid', lat: 40.42, lon: -3.70 },
  { name: 'Rome', lat: 41.90, lon: 12.50 },
  { name: 'Amsterdam', lat: 52.37, lon: 4.90 },
  { name: 'Vienna', lat: 48.21, lon: 16.37 },
  { name: 'Warsaw', lat: 52.23, lon: 21.01 },
  { name: 'Stockholm', lat: 59.33, lon: 18.07 },
  { name: 'Oslo', lat: 59.91, lon: 10.75 },
  { name: 'Toronto', lat: 43.65, lon: -79.38 },
  { name: 'Vancouver', lat: 49.25, lon: -123.12 },
  { name: 'Montreal', lat: 45.50, lon: -73.57 },
  { name: 'Calgary', lat: 51.05, lon: -114.07 },
  { name: 'Edmonton', lat: 53.55, lon: -113.47 },
  { name: 'Tokyo', lat: 35.69, lon: 139.69 },
  { name: 'Seoul', lat: 37.57, lon: 126.98 },
  { name: 'Beijing', lat: 39.91, lon: 116.39 },
  { name: 'Shanghai', lat: 31.23, lon: 121.47 },
  { name: 'Hong Kong', lat: 22.32, lon: 114.17 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Melbourne', lat: -37.81, lon: 144.96 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Delhi', lat: 28.66, lon: 77.23 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Rio de Janeiro', lat: -22.91, lon: -43.17 },
  { name: 'Mexico City', lat: 19.43, lon: -99.13 },
  { name: 'Buenos Aires', lat: -34.60, lon: -58.38 },
  { name: 'Cairo', lat: 30.06, lon: 31.25 },
  { name: 'Lagos', lat: 6.45, lon: 3.40 },
  { name: 'Johannesburg', lat: -26.20, lon: 28.04 },
  { name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { name: 'Istanbul', lat: 41.01, lon: 28.95 },
  { name: 'Dubai', lat: 25.20, lon: 55.27 },
  { name: 'Riyadh', lat: 24.69, lon: 46.72 },
  { name: 'Tehran', lat: 35.69, lon: 51.42 },
  { name: 'Karachi', lat: 24.86, lon: 67.01 },
  { name: 'Dhaka', lat: 23.72, lon: 90.41 },
  { name: 'Bangkok', lat: 13.75, lon: 100.52 },
];

type GetWeatherFn = (req: WeatherRequest) => Promise<unknown>;

export class CacheWarmer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private getWeather: GetWeatherFn;

  constructor(getWeather: GetWeatherFn, intervalMs = 10 * 60 * 1000) {
    this.getWeather = getWeather;
    this.intervalMs = intervalMs;
  }

  start(): void {
    logger.info({ cities: TOP_CITIES.length, intervalMs: this.intervalMs }, 'Cache warmer starting');
    this.warmAll().catch((err) => logger.error({ err }, 'Initial cache warm failed'));
    this.timer = setInterval(() => {
      this.warmAll().catch((err) => logger.error({ err }, 'Scheduled cache warm failed'));
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Cache warmer stopped');
    }
  }

  private async warmAll(): Promise<void> {
    const start = Date.now();
    let succeeded = 0;
    let failed = 0;

    const batches = this.chunk(TOP_CITIES, 5);
    for (const batch of batches) {
      await Promise.all(
        batch.map(async (city) => {
          try {
            await this.getWeather({ latitude: city.lat, longitude: city.lon });
            succeeded++;
          } catch {
            failed++;
          }
        })
      );
    }

    logger.info(
      { succeeded, failed, duration: Date.now() - start },
      'Cache warm complete'
    );
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
