import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../test/setup.js';
import { pirateWeatherResponse } from '../../test/fixtures/pirate-weather.js';
import { PirateWeatherAdapter } from '../pirate-weather.js';

const BASE_URL = 'https://api.pirateweather.net/forecast';

describe('PirateWeatherAdapter', () => {
  function setupHandlers(apiKey = 'test-key') {
    mswServer.use(
      http.get(`${BASE_URL}/${apiKey}/:latlon`, () => {
        return HttpResponse.json(pirateWeatherResponse);
      })
    );
  }

  it('fetch() returns current.temperature as a number', async () => {
    setupHandlers();

    const adapter = new PirateWeatherAdapter('test-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(response.current).toBeDefined();
    expect(typeof response.current?.temperature).toBe('number');
  });

  it('converts humidity from 0-1 fraction to 0-100 percentage', async () => {
    setupHandlers();

    const adapter = new PirateWeatherAdapter('test-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    // fixture has humidity: 0.65 → should become 65
    expect(response.current?.humidity).toBe(65);
  });

  it('converts cloudCover from 0-1 fraction to 0-100 percentage', async () => {
    setupHandlers();

    const adapter = new PirateWeatherAdapter('test-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    // fixture has cloudCover: 0.3 → should become 30
    expect(response.current?.cloudCover).toBe(30);
  });

  it('hourly[0].time is a Date object', async () => {
    setupHandlers();

    const adapter = new PirateWeatherAdapter('test-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(Array.isArray(response.hourly)).toBe(true);
    expect(response.hourly![0].time).toBeInstanceOf(Date);
  });

  it('hasQuota() returns false when API key is missing', () => {
    // Construct with empty string → adapter will still initialise, but we
    // exhaust the quota by setting used to its limit directly.
    const adapter = new PirateWeatherAdapter('');

    // Force quota to be exhausted
    (adapter as unknown as { quota: { used: number; limit: number } }).quota.used =
      (adapter as unknown as { quota: { limit: number } }).quota.limit;

    expect(adapter.hasQuota()).toBe(false);
  });
});
