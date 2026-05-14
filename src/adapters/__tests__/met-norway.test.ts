import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../test/setup.js';
import { metNorwayResponse } from '../../test/fixtures/met-norway.js';
import { MetNorwayAdapter } from '../met-norway.js';

describe('MetNorwayAdapter', () => {
  function setupHandlers() {
    mswServer.use(
      http.get(
        'https://api.met.no/weatherapi/locationforecast/2.0/compact',
        () => {
          return HttpResponse.json(metNorwayResponse);
        }
      )
    );
  }

  it('fetches forecast and response.current exists', async () => {
    setupHandlers();

    const adapter = new MetNorwayAdapter();
    const response = await adapter.fetch({ latitude: 59.9139, longitude: 10.7522 });

    expect(response.current).toBeDefined();
  });

  it('parses temperature as a number', async () => {
    setupHandlers();

    const adapter = new MetNorwayAdapter();
    const response = await adapter.fetch({ latitude: 59.9139, longitude: 10.7522 });

    expect(typeof response.current?.temperature).toBe('number');
  });

  it('returns hourly and daily arrays', async () => {
    setupHandlers();

    const adapter = new MetNorwayAdapter();
    const response = await adapter.fetch({ latitude: 59.9139, longitude: 10.7522 });

    expect(Array.isArray(response.hourly)).toBe(true);
    expect(Array.isArray(response.daily)).toBe(true);
  });

  it('returns correct provider', async () => {
    setupHandlers();

    const adapter = new MetNorwayAdapter();
    const response = await adapter.fetch({ latitude: 59.9139, longitude: 10.7522 });

    expect(response.raw.provider).toBe('met-norway');
  });

  it('isInCoverageArea returns true for Oslo coordinates', () => {
    const adapter = new MetNorwayAdapter();
    expect(adapter.isInCoverageArea(59.9, 10.7)).toBe(true);
  });

  it('isInCoverageArea returns false for New York coordinates', () => {
    const adapter = new MetNorwayAdapter();
    expect(adapter.isInCoverageArea(40.7, -74.0)).toBe(false);
  });
});
