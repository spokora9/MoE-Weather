import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../test/setup.js';
import {
  ecccForecastResponse,
  ecccAlertsResponse,
  ecccAlertsEmpty,
} from '../../test/fixtures/eccc-canada.js';
import { ECCCCanadaAdapter } from '../eccc-canada.js';

const TORONTO_LAT = 43.65;
const TORONTO_LON = -79.38;

const VANCOUVER_LAT = 49.25;
const VANCOUVER_LON = -123.12;

const NEW_YORK_LAT = 40.71;
const NEW_YORK_LON = -74.01;

const ECCC_BASE = 'https://api.weather.gc.ca';

function setupHandlers(alertsBody = ecccAlertsEmpty) {
  mswServer.use(
    http.get(
      `${ECCC_BASE}/collections/weather:forecast-model-hrdps-continental/items`,
      () => HttpResponse.json(ecccForecastResponse)
    ),
    http.get(
      `${ECCC_BASE}/collections/alerts/items`,
      () => HttpResponse.json(alertsBody)
    )
  );
}

describe('ECCCCanadaAdapter', () => {
  describe('isInCoverageArea', () => {
    it('returns true for Toronto coordinates', () => {
      const adapter = new ECCCCanadaAdapter();
      expect(adapter.isInCoverageArea(TORONTO_LAT, TORONTO_LON)).toBe(true);
    });

    it('returns true for Vancouver coordinates', () => {
      const adapter = new ECCCCanadaAdapter();
      expect(adapter.isInCoverageArea(VANCOUVER_LAT, VANCOUVER_LON)).toBe(true);
    });

    it('returns false for New York coordinates', () => {
      const adapter = new ECCCCanadaAdapter();
      expect(adapter.isInCoverageArea(NEW_YORK_LAT, NEW_YORK_LON)).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('returns eccc-canada', () => {
      const adapter = new ECCCCanadaAdapter();
      expect(adapter.getProvider()).toBe('eccc-canada');
    });
  });

  describe('getBaseWeight', () => {
    it('returns 0.30', () => {
      const adapter = new ECCCCanadaAdapter();
      expect(adapter.getBaseWeight()).toBe(0.30);
    });
  });

  describe('fetch', () => {
    it('returns an error response for non-Canadian coordinates', async () => {
      const adapter = new ECCCCanadaAdapter();
      const response = await adapter.fetch({ latitude: NEW_YORK_LAT, longitude: NEW_YORK_LON });

      expect(response.raw.provider).toBe('eccc-canada');
      expect((response.raw.data as Record<string, unknown>).error).toBeDefined();
    });

    it('returns current.temperature as a number for Canadian coordinates', async () => {
      setupHandlers();

      const adapter = new ECCCCanadaAdapter();
      const response = await adapter.fetch({ latitude: TORONTO_LAT, longitude: TORONTO_LON });

      expect(response.current).toBeDefined();
      expect(typeof response.current?.temperature).toBe('number');
    });

    it('maps temperature correctly from TMP field', async () => {
      setupHandlers();

      const adapter = new ECCCCanadaAdapter();
      const response = await adapter.fetch({ latitude: TORONTO_LAT, longitude: TORONTO_LON });

      // Fixture has TMP: 15.2
      expect(response.current?.temperature).toBe(15.2);
    });

    it('maps wind speed from km/h to m/s', async () => {
      setupHandlers();

      const adapter = new ECCCCanadaAdapter();
      const response = await adapter.fetch({ latitude: TORONTO_LAT, longitude: TORONTO_LON });

      // Fixture WSPD: 20.0 km/h → 20/3.6 ≈ 5.556 m/s
      expect(response.current?.windSpeed).toBeCloseTo(20.0 / 3.6, 3);
    });

    it('maps pressure from Pa to hPa', async () => {
      setupHandlers();

      const adapter = new ECCCCanadaAdapter();
      const response = await adapter.fetch({ latitude: TORONTO_LAT, longitude: TORONTO_LON });

      // Fixture PRMSL: 101300 Pa → 1013 hPa
      expect(response.current?.pressure).toBeCloseTo(1013, 0);
    });

    it('returns raw provider as eccc-canada', async () => {
      setupHandlers();

      const adapter = new ECCCCanadaAdapter();
      const response = await adapter.fetch({ latitude: TORONTO_LAT, longitude: TORONTO_LON });

      expect(response.raw.provider).toBe('eccc-canada');
    });

    it('returns empty alerts array when no alerts are present', async () => {
      setupHandlers(ecccAlertsEmpty);

      const adapter = new ECCCCanadaAdapter();
      const response = await adapter.fetch({ latitude: TORONTO_LAT, longitude: TORONTO_LON });

      expect(response.alerts).toBeDefined();
      expect(response.alerts).toHaveLength(0);
    });

    it('returns alert in response.alerts when a mocked alert is present', async () => {
      setupHandlers(ecccAlertsResponse as any);

      const adapter = new ECCCCanadaAdapter();
      const response = await adapter.fetch({
        latitude: TORONTO_LAT,
        longitude: TORONTO_LON,
        includeAlerts: true,
      });

      expect(response.alerts).toBeDefined();
      expect(response.alerts!.length).toBeGreaterThan(0);

      const alert = response.alerts![0];
      expect(alert.event).toBe('WIND WARNING');
      expect(alert.severity).toBe('moderate');
      expect(alert.source).toBe('ECCC');
    });
  });
});
