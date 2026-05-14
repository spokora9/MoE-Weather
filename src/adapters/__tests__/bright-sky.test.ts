import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../test/setup.js';
import { brightSkyWeather, brightSkyAlerts } from '../../test/fixtures/bright-sky.js';
import { BrightSkyAdapter } from '../bright-sky.js';

describe('BrightSkyAdapter', () => {
  function setupHandlers() {
    mswServer.use(
      http.get('https://api.brightsky.dev/weather', () => {
        return HttpResponse.json(brightSkyWeather);
      }),
      http.get('https://api.brightsky.dev/alerts', () => {
        return HttpResponse.json(brightSkyAlerts);
      })
    );
  }

  it('fetches current weather and returns temperature as a number', async () => {
    setupHandlers();

    const adapter = new BrightSkyAdapter();
    // Use coordinates inside Germany coverage area
    const response = await adapter.fetch({ latitude: 52.52, longitude: 13.405 });

    expect(response.current).toBeDefined();
    expect(typeof response.current?.temperature).toBe('number');
  });

  it('returns correct provider', async () => {
    setupHandlers();

    const adapter = new BrightSkyAdapter();
    const response = await adapter.fetch({ latitude: 52.52, longitude: 13.405 });

    expect(response.raw.provider).toBe('bright-sky');
  });

  it('returns error for location outside coverage', async () => {
    const adapter = new BrightSkyAdapter();
    const response = await adapter.fetch({ latitude: 40.7, longitude: -74.0 });

    expect((response.raw.data as Record<string, unknown>).error).toBeDefined();
  });

  it('isInCoverageArea returns true for Germany coordinates', () => {
    const adapter = new BrightSkyAdapter();
    expect(adapter.isInCoverageArea(51.5, 10.0)).toBe(true);
  });

  it('isInCoverageArea returns false for New York coordinates', () => {
    const adapter = new BrightSkyAdapter();
    expect(adapter.isInCoverageArea(40.7, -74.0)).toBe(false);
  });
});
