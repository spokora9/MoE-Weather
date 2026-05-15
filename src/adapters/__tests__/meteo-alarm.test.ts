import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../test/setup.js';
import {
  meteoAlarmFeedWithAlert,
  meteoAlarmFeedEmpty,
} from '../../test/fixtures/meteo-alarm.js';
import { MeteoAlarmAdapter } from '../meteo-alarm.js';

// Feed URL pattern: https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-{cc}
const FEED_BASE = 'https://feeds.meteoalarm.org/feeds';

describe('MeteoAlarmAdapter', () => {
  // -------------------------------------------------------------------------
  // isInCoverageArea
  // -------------------------------------------------------------------------
  describe('isInCoverageArea', () => {
    const adapter = new MeteoAlarmAdapter();

    it('returns true for London, UK (51.5, -0.1)', () => {
      expect(adapter.isInCoverageArea(51.5, -0.1)).toBe(true);
    });

    it('returns true for Paris, France (48.9, 2.4)', () => {
      expect(adapter.isInCoverageArea(48.9, 2.4)).toBe(true);
    });

    it('returns false for New York (40.7, -74.0)', () => {
      expect(adapter.isInCoverageArea(40.7, -74.0)).toBe(false);
    });

    it('returns false for Sydney (-33.9, 151.2)', () => {
      expect(adapter.isInCoverageArea(-33.9, 151.2)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // fetch() — with an active alert in the feed
  // -------------------------------------------------------------------------
  describe('fetch() with an alert in the feed', () => {
    function setupAlertHandler() {
      mswServer.use(
        http.get(`${FEED_BASE}/meteoalarm-legacy-atom-gb`, () => {
          return new HttpResponse(meteoAlarmFeedWithAlert, {
            status: 200,
            headers: { 'Content-Type': 'application/atom+xml' },
          });
        })
      );
    }

    it('returns a non-empty alerts array', async () => {
      setupAlertHandler();
      const adapter = new MeteoAlarmAdapter();
      const response = await adapter.fetch({ latitude: 51.5, longitude: -0.1 });
      expect(Array.isArray(response.alerts)).toBe(true);
      expect(response.alerts!.length).toBeGreaterThan(0);
    });

    it('parses alert severity as "severe"', async () => {
      setupAlertHandler();
      const adapter = new MeteoAlarmAdapter();
      const response = await adapter.fetch({ latitude: 51.5, longitude: -0.1 });
      expect(response.alerts![0].severity).toBe('severe');
    });

    it('parses alert headline from <title>', async () => {
      setupAlertHandler();
      const adapter = new MeteoAlarmAdapter();
      const response = await adapter.fetch({ latitude: 51.5, longitude: -0.1 });
      expect(response.alerts![0].headline).toBe(
        'Severe wind warning for southern England'
      );
    });

    it('parses alert urgency as "expected"', async () => {
      setupAlertHandler();
      const adapter = new MeteoAlarmAdapter();
      const response = await adapter.fetch({ latitude: 51.5, longitude: -0.1 });
      expect(response.alerts![0].urgency).toBe('expected');
    });

    it('sets source to "MeteoAlarm"', async () => {
      setupAlertHandler();
      const adapter = new MeteoAlarmAdapter();
      const response = await adapter.fetch({ latitude: 51.5, longitude: -0.1 });
      expect(response.alerts![0].source).toBe('MeteoAlarm');
    });

    it('sets provider to "meteo-alarm" in raw response', async () => {
      setupAlertHandler();
      const adapter = new MeteoAlarmAdapter();
      const response = await adapter.fetch({ latitude: 51.5, longitude: -0.1 });
      expect(response.raw.provider).toBe('meteo-alarm');
    });
  });

  // -------------------------------------------------------------------------
  // fetch() — with an empty feed (no alerts)
  // -------------------------------------------------------------------------
  describe('fetch() with an empty feed', () => {
    function setupEmptyHandler() {
      mswServer.use(
        http.get(`${FEED_BASE}/meteoalarm-legacy-atom-gb`, () => {
          return new HttpResponse(meteoAlarmFeedEmpty, {
            status: 200,
            headers: { 'Content-Type': 'application/atom+xml' },
          });
        })
      );
    }

    it('returns an empty alerts array (not an error)', async () => {
      setupEmptyHandler();
      const adapter = new MeteoAlarmAdapter();
      const response = await adapter.fetch({ latitude: 51.5, longitude: -0.1 });
      expect(Array.isArray(response.alerts)).toBe(true);
      expect(response.alerts!.length).toBe(0);
    });

    it('does not set an error in raw.data', async () => {
      setupEmptyHandler();
      const adapter = new MeteoAlarmAdapter();
      const response = await adapter.fetch({ latitude: 51.5, longitude: -0.1 });
      expect((response.raw.data as Record<string, unknown>).error).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // fetch() — location outside coverage area
  // -------------------------------------------------------------------------
  describe('fetch() outside coverage area', () => {
    it('returns empty alerts array for New York', async () => {
      const adapter = new MeteoAlarmAdapter();
      const response = await adapter.fetch({ latitude: 40.7, longitude: -74.0 });
      expect(Array.isArray(response.alerts)).toBe(true);
      expect(response.alerts!.length).toBe(0);
    });

    it('includes an error message in raw.data for out-of-coverage location', async () => {
      const adapter = new MeteoAlarmAdapter();
      const response = await adapter.fetch({ latitude: 40.7, longitude: -74.0 });
      expect((response.raw.data as Record<string, unknown>).error).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Caching — second call within 60 s should be served from cache
  // -------------------------------------------------------------------------
  describe('caching', () => {
    it('serves cached results on repeated calls within TTL', async () => {
      let callCount = 0;
      mswServer.use(
        http.get(`${FEED_BASE}/meteoalarm-legacy-atom-gb`, () => {
          callCount++;
          return new HttpResponse(meteoAlarmFeedWithAlert, {
            status: 200,
            headers: { 'Content-Type': 'application/atom+xml' },
          });
        })
      );

      const adapter = new MeteoAlarmAdapter();
      // First call — should hit the network
      await adapter.fetch({ latitude: 51.5, longitude: -0.1 });
      // Second call — should be served from cache
      const secondResponse = await adapter.fetch({ latitude: 51.5, longitude: -0.1 });

      expect(callCount).toBe(1);
      expect(Array.isArray(secondResponse.alerts)).toBe(true);
    });
  });
});
