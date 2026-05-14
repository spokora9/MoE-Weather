import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../test/setup.js';
import { openMeteoFixture } from '../../test/fixtures/open-meteo.js';
import { OpenMeteoAdapter } from '../open-meteo.js';

describe('OpenMeteoAdapter', () => {
  it('fetches and parses current weather', async () => {
    mswServer.use(
      http.get('https://api.open-meteo.com/v1/forecast', () => {
        return HttpResponse.json(openMeteoFixture);
      })
    );

    const adapter = new OpenMeteoAdapter();
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(response.current).toBeDefined();
    expect(typeof response.current?.temperature).toBe('number');
  });

  it('parses hourly forecast array', async () => {
    mswServer.use(
      http.get('https://api.open-meteo.com/v1/forecast', () => {
        return HttpResponse.json(openMeteoFixture);
      })
    );

    const adapter = new OpenMeteoAdapter();
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(Array.isArray(response.hourly)).toBe(true);
    expect((response.hourly?.length ?? 0) > 0).toBe(true);
  });

  it('parses daily forecast array', async () => {
    mswServer.use(
      http.get('https://api.open-meteo.com/v1/forecast', () => {
        return HttpResponse.json(openMeteoFixture);
      })
    );

    const adapter = new OpenMeteoAdapter();
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(Array.isArray(response.daily)).toBe(true);
    expect((response.daily?.length ?? 0) > 0).toBe(true);
  });

  it('returns correct provider in raw response', async () => {
    mswServer.use(
      http.get('https://api.open-meteo.com/v1/forecast', () => {
        return HttpResponse.json(openMeteoFixture);
      })
    );

    const adapter = new OpenMeteoAdapter();
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(response.raw.provider).toBe('open-meteo');
  });
});
