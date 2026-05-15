import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../test/setup.js';
import {
  nwsPoints,
  nwsStations,
  nwsObservation,
  nwsForecast,
  nwsHourlyForecast,
} from '../../test/fixtures/nws.js';
import { NWSAdapter } from '../nws.js';

const NYC_LAT = 40.7128;
const NYC_LON = -74.006;

function setupNWSHandlers() {
  mswServer.use(
    // Points endpoint
    http.get('https://api.weather.gov/points/:lat,:lon', () => {
      return HttpResponse.json(nwsPoints);
    }),
    // Stations endpoint
    http.get('https://api.weather.gov/gridpoints/:gridId/:gridX,:gridY/stations', () => {
      return HttpResponse.json(nwsStations);
    }),
    // Latest observation
    http.get('https://api.weather.gov/stations/:stationId/observations/latest', () => {
      return HttpResponse.json(nwsObservation);
    }),
    // Daily forecast
    http.get('https://api.weather.gov/gridpoints/:gridId/:gridX,:gridY/forecast', () => {
      return HttpResponse.json(nwsForecast);
    }),
    // Hourly forecast
    http.get('https://api.weather.gov/gridpoints/:gridId/:gridX,:gridY/forecast/hourly', () => {
      return HttpResponse.json(nwsHourlyForecast);
    }),
    // Alerts
    http.get('https://api.weather.gov/alerts/active', () => {
      return HttpResponse.json({ features: [] });
    })
  );
}

describe('NWSAdapter', () => {
  it('fetches data for US coordinates and returns current weather', async () => {
    setupNWSHandlers();

    const adapter = new NWSAdapter();
    const response = await adapter.fetch({ latitude: NYC_LAT, longitude: NYC_LON });

    expect(response.current).toBeDefined();
  });

  it('returns error response for non-US coordinates', async () => {
    const adapter = new NWSAdapter();
    const response = await adapter.fetch({ latitude: 51.5074, longitude: -0.1278 });

    // NWS only covers US; should return a raw-only response with an error
    expect(response.raw.provider).toBe('nws');
    expect((response.raw.data as Record<string, unknown>).error).toBeDefined();
  });

  it('provides correct provider in raw response', async () => {
    setupNWSHandlers();

    const adapter = new NWSAdapter();
    const response = await adapter.fetch({ latitude: NYC_LAT, longitude: NYC_LON });

    expect(response.raw.provider).toBe('nws');
  });
});
