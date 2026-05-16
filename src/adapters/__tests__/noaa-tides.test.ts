import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../test/setup.js';
import { noaaTidesAdapter, type TidePrediction } from '../noaa-tides.js';

// ── NOAA endpoint base URLs ──────────────────────────────────────────────────
const MDAPI_BASE = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi';
const DATAGETTER_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

// ── Fixture data ─────────────────────────────────────────────────────────────
const STATION_RESPONSE = {
  stations: [
    { id: '8443970', name: 'Boston, MA' },
  ],
};

const TIDE_PREDICTIONS_RESPONSE = {
  predictions: [
    { t: '2026-05-14 06:12', v: '1.45', type: 'H' },
    { t: '2026-05-14 12:34', v: '0.23', type: 'L' },
    { t: '2026-05-14 18:56', v: '1.32', type: 'H' },
    { t: '2026-05-15 01:10', v: '0.11', type: 'L' },
  ],
};

// ── MSW handler helpers ───────────────────────────────────────────────────────
function setupSuccessHandlers() {
  mswServer.use(
    http.get(`${MDAPI_BASE}/stations.json`, () => {
      return HttpResponse.json(STATION_RESPONSE);
    }),
    http.get(DATAGETTER_BASE, () => {
      return HttpResponse.json(TIDE_PREDICTIONS_RESPONSE);
    }),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('NOAATidesAdapter', () => {
  // ── isUSLocation ─────────────────────────────────────────────────────────
  describe('isUSLocation()', () => {
    it('returns true for Boston (42.36, -71.06)', () => {
      expect(noaaTidesAdapter.isUSLocation(42.36, -71.06)).toBe(true);
    });

    it('returns false for London (51.5, -0.1)', () => {
      expect(noaaTidesAdapter.isUSLocation(51.5, -0.1)).toBe(false);
    });

    it('returns false for Sydney (-33.87, 151.21)', () => {
      expect(noaaTidesAdapter.isUSLocation(-33.87, 151.21)).toBe(false);
    });
  });

  // ── getTidePredictions — US location ─────────────────────────────────────
  describe('getTidePredictions() for a US location', () => {
    it('returns an array of TidePrediction objects', async () => {
      setupSuccessHandlers();
      const results = await noaaTidesAdapter.getTidePredictions(42.36, -71.06);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(4);
    });

    it('each prediction has time (Date), height (number), and type', async () => {
      setupSuccessHandlers();
      const results = await noaaTidesAdapter.getTidePredictions(42.36, -71.06);
      for (const p of results) {
        expect(p.time).toBeInstanceOf(Date);
        expect(typeof p.height).toBe('number');
        expect(['high', 'low']).toContain(p.type);
      }
    });

    it('maps type "H" in NOAA response to "high" in output', async () => {
      setupSuccessHandlers();
      const results = await noaaTidesAdapter.getTidePredictions(42.36, -71.06);
      // First and third predictions have type "H"
      expect(results[0].type).toBe('high');
      expect(results[2].type).toBe('high');
    });

    it('maps type "L" in NOAA response to "low" in output', async () => {
      setupSuccessHandlers();
      const results = await noaaTidesAdapter.getTidePredictions(42.36, -71.06);
      // Second and fourth predictions have type "L"
      expect(results[1].type).toBe('low');
      expect(results[3].type).toBe('low');
    });

    it('parses height values as floats', async () => {
      setupSuccessHandlers();
      const results = await noaaTidesAdapter.getTidePredictions(42.36, -71.06);
      expect(results[0].height).toBeCloseTo(1.45);
      expect(results[1].height).toBeCloseTo(0.23);
    });
  });

  // ── getTidePredictions — non-US location ─────────────────────────────────
  describe('getTidePredictions() for a non-US location', () => {
    it('returns empty array without making any API call', async () => {
      // Register a handler that would fail the test if called
      let apiCalled = false;
      mswServer.use(
        http.get(`${MDAPI_BASE}/stations.json`, () => {
          apiCalled = true;
          return HttpResponse.json(STATION_RESPONSE);
        }),
        http.get(DATAGETTER_BASE, () => {
          apiCalled = true;
          return HttpResponse.json(TIDE_PREDICTIONS_RESPONSE);
        }),
      );

      // London — outside US bounds
      const results = await noaaTidesAdapter.getTidePredictions(51.5, -0.1);
      expect(results).toEqual([]);
      expect(apiCalled).toBe(false);
    });
  });

  // ── getTidePredictions — network error ───────────────────────────────────
  describe('getTidePredictions() on network error', () => {
    it('returns empty array when station lookup fails with a network error', async () => {
      mswServer.use(
        http.get(`${MDAPI_BASE}/stations.json`, () => {
          return HttpResponse.error();
        }),
      );

      const results = await noaaTidesAdapter.getTidePredictions(42.36, -71.06);
      expect(results).toEqual([]);
    });

    it('returns empty array when tide data fetch fails with a network error', async () => {
      mswServer.use(
        // Station lookup succeeds
        http.get(`${MDAPI_BASE}/stations.json`, () => {
          return HttpResponse.json(STATION_RESPONSE);
        }),
        // Tide fetch fails
        http.get(DATAGETTER_BASE, () => {
          return HttpResponse.error();
        }),
      );

      // Use slightly different coords so the station cache from previous tests
      // doesn't mask the tide-fetch network error.
      const results = await noaaTidesAdapter.getTidePredictions(42.4, -71.1);
      expect(results).toEqual([]);
    });
  });
});
