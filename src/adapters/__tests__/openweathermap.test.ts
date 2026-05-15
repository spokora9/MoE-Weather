import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../test/setup.js';
import { owmCurrentWeather, owmForecast } from '../../test/fixtures/openweathermap.js';
import { OpenWeatherMapAdapter } from '../openweathermap.js';

describe('OpenWeatherMapAdapter', () => {
  function setupHandlers() {
    mswServer.use(
      http.get('https://api.openweathermap.org/data/2.5/weather', () => {
        return HttpResponse.json(owmCurrentWeather);
      }),
      http.get('https://api.openweathermap.org/data/2.5/forecast', () => {
        return HttpResponse.json(owmForecast);
      })
    );
  }

  it('fetches current weather and returns a temperature number', async () => {
    setupHandlers();

    const adapter = new OpenWeatherMapAdapter('test-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(response.current).toBeDefined();
    expect(typeof response.current?.temperature).toBe('number');
  });

  it('parses hourly forecast array', async () => {
    setupHandlers();

    const adapter = new OpenWeatherMapAdapter('test-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(Array.isArray(response.hourly)).toBe(true);
  });

  it('parses daily forecast array', async () => {
    setupHandlers();

    const adapter = new OpenWeatherMapAdapter('test-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(Array.isArray(response.daily)).toBe(true);
  });

  it('returns correct provider in raw response', async () => {
    setupHandlers();

    const adapter = new OpenWeatherMapAdapter('test-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(response.raw.provider).toBe('openweathermap');
  });
});
