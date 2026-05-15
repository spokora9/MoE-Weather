import type { AdapterResponse } from '../../adapters/index.js';
import type { WeatherProvider } from '../../types/weather.js';

export function createMockAdapterResponse(overrides: Partial<AdapterResponse> = {}): AdapterResponse {
  return {
    current: {
      temperature: 20,
      feelsLike: 19,
      humidity: 65,
      pressure: 1013,
      windSpeed: 10,
      windDirection: 180,
      weatherCode: 0,
      visibility: 10000,
      cloudCover: 20,
      weatherDescription: 'Clear sky',
      timestamp: new Date(),
      ...overrides.current,
    },
    hourly: [],
    daily: [],
    alerts: [],
    raw: { provider: 'open-meteo' as WeatherProvider, data: {}, fetchedAt: new Date(), responseTime: 0 },
    ...overrides,
  };
}
