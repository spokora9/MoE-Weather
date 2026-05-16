import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../test/setup.js';
import { TomorrowIOAdapter } from '../tomorrow-io.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const tomorrowForecastFixture = {
  timelines: {
    hourly: [
      {
        time: '2026-05-14T12:00:00Z',
        values: {
          temperature: 20,
          humidity: 65,
          windSpeed: 5,
          windDirection: 180,
          precipitationProbability: 10,
          weatherCode: 1000,
        },
      },
      {
        time: '2026-05-14T13:00:00Z',
        values: {
          temperature: 22,
          humidity: 60,
          windSpeed: 6,
          windDirection: 190,
          precipitationProbability: 5,
          weatherCode: 1001,
        },
      },
    ],
    daily: [
      {
        time: '2026-05-14T00:00:00Z',
        values: {
          temperatureMax: 25,
          temperatureMin: 15,
          precipitationProbabilityAvg: 5,
          windSpeedAvg: 8,
        },
      },
      {
        time: '2026-05-15T00:00:00Z',
        values: {
          temperatureMax: 23,
          temperatureMin: 13,
          precipitationProbabilityAvg: 20,
          windSpeedAvg: 10,
        },
      },
    ],
  },
};

const tomorrowNowcastFixture = {
  timelines: {
    minutely: [
      {
        time: '2026-05-14T12:00:00Z',
        values: { precipitationIntensity: 0.5, precipitationProbability: 30 },
      },
      {
        time: '2026-05-14T12:01:00Z',
        values: { precipitationIntensity: 0.8, precipitationProbability: 45 },
      },
      {
        time: '2026-05-14T12:02:00Z',
        values: { precipitationIntensity: 0.0, precipitationProbability: 10 },
      },
    ],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupForecastHandler() {
  mswServer.use(
    http.get('https://api.tomorrow.io/v4/weather/forecast', ({ request }) => {
      const url = new URL(request.url);
      const timesteps = url.searchParams.get('timesteps') ?? '';
      if (timesteps.includes('1m')) {
        return HttpResponse.json(tomorrowNowcastFixture);
      }
      return HttpResponse.json(tomorrowForecastFixture);
    })
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TomorrowIOAdapter', () => {
  const savedKey = process.env.TOMORROW_IO_API_KEY;

  beforeEach(() => {
    process.env.TOMORROW_IO_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    if (savedKey === undefined) {
      delete process.env.TOMORROW_IO_API_KEY;
    } else {
      process.env.TOMORROW_IO_API_KEY = savedKey;
    }
  });

  it('fetch() returns current.temperature as a number', async () => {
    setupForecastHandler();

    const adapter = new TomorrowIOAdapter('test-api-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(response.current).toBeDefined();
    expect(typeof response.current?.temperature).toBe('number');
  });

  it('fetch() returns an hourly array', async () => {
    setupForecastHandler();

    const adapter = new TomorrowIOAdapter('test-api-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(Array.isArray(response.hourly)).toBe(true);
    expect(response.hourly!.length).toBeGreaterThan(0);
  });

  it('fetch() returns a daily array', async () => {
    setupForecastHandler();

    const adapter = new TomorrowIOAdapter('test-api-key');
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    expect(Array.isArray(response.daily)).toBe(true);
    expect(response.daily!.length).toBeGreaterThan(0);
  });

  it('getNowcast() returns an array with precipitationIntensity field', async () => {
    setupForecastHandler();

    const adapter = new TomorrowIOAdapter('test-api-key');
    const nowcast = await adapter.getNowcast(51.5074, -0.1278);

    expect(Array.isArray(nowcast)).toBe(true);
    expect(nowcast.length).toBeGreaterThan(0);
    expect(typeof nowcast[0].precipitationIntensity).toBe('number');
    expect(typeof nowcast[0].precipitationProbability).toBe('number');
    expect(typeof nowcast[0].time).toBe('string');
  });

  it('hasQuota() returns false when TOMORROW_IO_API_KEY is not set', () => {
    delete process.env.TOMORROW_IO_API_KEY;

    // Construct adapter without passing a key so it reads from the env var
    const adapter = new TomorrowIOAdapter();

    expect(adapter.hasQuota()).toBe(false);
  });
});
