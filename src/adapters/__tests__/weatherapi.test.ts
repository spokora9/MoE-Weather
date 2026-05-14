import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../test/setup.js';
import { weatherApiResponse } from '../../test/fixtures/weatherapi.js';
import { WeatherAPIAdapter } from '../weatherapi.js';

describe('WeatherAPIAdapter', () => {
  function setupHandlers() {
    mswServer.use(
      http.get('https://api.weatherapi.com/v1/forecast.json', () => {
        return HttpResponse.json(weatherApiResponse);
      })
    );
  }

  it('fetches current weather and response.current exists', async () => {
    setupHandlers();

    const adapter = new WeatherAPIAdapter('test-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(response.current).toBeDefined();
  });

  it('parses temperature as a number', async () => {
    setupHandlers();

    const adapter = new WeatherAPIAdapter('test-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(typeof response.current?.temperature).toBe('number');
  });

  it('returns hourly and daily arrays', async () => {
    setupHandlers();

    const adapter = new WeatherAPIAdapter('test-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(Array.isArray(response.hourly)).toBe(true);
    expect(Array.isArray(response.daily)).toBe(true);
  });

  it('returns correct provider', async () => {
    setupHandlers();

    const adapter = new WeatherAPIAdapter('test-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(response.raw.provider).toBe('weatherapi');
  });
});
