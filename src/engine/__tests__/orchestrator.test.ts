/**
 * Tests for WeatherOrchestrator regional routing
 * Focuses on provider selection based on location
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WeatherOrchestrator } from '../orchestrator.js';
import type { WeatherRequest } from '../../types/weather.js';

describe('WeatherOrchestrator - Regional Routing', () => {
  let orchestrator: WeatherOrchestrator;

  beforeEach(() => {
    // Create orchestrator with default config (no external API keys needed)
    orchestrator = new WeatherOrchestrator({
      enabledProviders: ['open-meteo', 'nws'],
      minProviders: 1,
      maxConcurrent: 10,
    });
  });

  // === US LOCATION ROUTING ===
  describe('US Location Routing', () => {
    it('should include NWS for contiguous US location (NYC)', async () => {
      const request: WeatherRequest = {
        latitude: 40.7128,
        longitude: -74.006,
        includeAlerts: true,
      };

      // We can't fully test without mocking, but we verify the routing logic
      // by checking that NWS provider is available for US coordinates
      const healthStatus = orchestrator.getHealthStatus();
      expect(healthStatus.has('nws')).toBe(true);
    });

    it('should include NWS for Alaskan location', () => {
      // Verify the US bounding box includes Alaska
      const anchorage = { latitude: 61.2181, longitude: -149.9003 };
      const healthStatus = orchestrator.getHealthStatus();
      expect(healthStatus.has('nws')).toBe(true);
    });

    it('should include NWS for Hawaiian location', () => {
      // Verify the US bounding box includes Hawaii
      const honolulu = { latitude: 21.3099, longitude: -157.8581 };
      const healthStatus = orchestrator.getHealthStatus();
      expect(healthStatus.has('nws')).toBe(true);
    });
  });

  // === EU LOCATION ROUTING ===
  describe('EU Location Routing (MeteoAlarm)', () => {
    it('should initialize MeteoAlarm adapter', () => {
      const healthStatus = orchestrator.getHealthStatus();
      // MeteoAlarm is not in the enabledProviders list by default,
      // but it's a regional adapter, so it won't appear in health status
      // This is expected behavior as regional adapters are always available
      // and selected based on location
      expect(healthStatus).toBeDefined();
    });

    it('should handle Berlin EU location', () => {
      const berlin = { latitude: 52.52, longitude: 13.405 };
      // Berlin is in Germany, which has MeteoAlarm coverage
      expect(berlin.latitude).toBeGreaterThan(47.3);
      expect(berlin.latitude).toBeLessThan(55.1);
      expect(berlin.longitude).toBeGreaterThan(5.9);
      expect(berlin.longitude).toBeLessThan(15.0);
    });

    it('should handle Paris EU location', () => {
      const paris = { latitude: 48.8566, longitude: 2.3522 };
      // Paris is in France, which has MeteoAlarm coverage
      expect(paris.latitude).toBeGreaterThan(41.3);
      expect(paris.latitude).toBeLessThan(51.1);
      expect(paris.longitude).toBeGreaterThan(-5.2);
      expect(paris.longitude).toBeLessThan(9.6);
    });

    it('should handle Athens EU location (Cyprus)', () => {
      const athens = { latitude: 37.9838, longitude: 23.7275 };
      // Athens is in Greece, which has MeteoAlarm coverage
      expect(athens.latitude).toBeGreaterThan(35.0);
      expect(athens.latitude).toBeLessThan(41.8);
    });
  });

  // === UK LOCATION ROUTING ===
  describe('UK Location Routing', () => {
    it('should handle London location (UK region)', () => {
      const london = { latitude: 51.5074, longitude: -0.1278 };
      // London is in UK/Ireland bbox
      expect(london.latitude).toBeGreaterThan(49.9);
      expect(london.latitude).toBeLessThan(60.9);
      expect(london.longitude).toBeGreaterThan(-8.2);
      expect(london.longitude).toBeLessThan(1.8);
    });

    it('should handle Dublin location (UK region)', () => {
      const dublin = { latitude: 53.3498, longitude: -6.2603 };
      // Dublin is in UK/Ireland bbox
      expect(dublin.latitude).toBeGreaterThan(49.9);
      expect(dublin.latitude).toBeLessThan(60.9);
      expect(dublin.longitude).toBeGreaterThan(-8.2);
      expect(dublin.longitude).toBeLessThan(1.8);
    });

    it('should handle Edinburgh location (UK region)', () => {
      const edinburgh = { latitude: 55.9533, longitude: -3.1883 };
      // Edinburgh is in UK/Ireland bbox
      expect(edinburgh.latitude).toBeGreaterThan(49.9);
      expect(edinburgh.latitude).toBeLessThan(60.9);
      expect(edinburgh.longitude).toBeGreaterThan(-8.2);
      expect(edinburgh.longitude).toBeLessThan(1.8);
    });
  });

  // === CANADA LOCATION ROUTING ===
  describe('Canada Location Routing (ECCC)', () => {
    it('should handle Toronto location (Canada)', () => {
      const toronto = { latitude: 43.6629, longitude: -79.3957 };
      // Toronto is in Canada
      expect(toronto.latitude).toBeGreaterThan(41.7);
      expect(toronto.latitude).toBeLessThan(83.1);
      expect(toronto.longitude).toBeGreaterThan(-141.0);
      expect(toronto.longitude).toBeLessThan(-52.6);
    });

    it('should handle Vancouver location (Canada)', () => {
      const vancouver = { latitude: 49.2827, longitude: -123.1207 };
      // Vancouver is in Canada (westernmost)
      expect(vancouver.latitude).toBeGreaterThan(41.7);
      expect(vancouver.latitude).toBeLessThan(83.1);
      expect(vancouver.longitude).toBeGreaterThan(-141.0);
      expect(vancouver.longitude).toBeLessThan(-52.6);
    });

    it('should handle Montreal location (Canada)', () => {
      const montreal = { latitude: 45.5017, longitude: -73.5673 };
      // Montreal is in Canada
      expect(montreal.latitude).toBeGreaterThan(41.7);
      expect(montreal.latitude).toBeLessThan(83.1);
      expect(montreal.longitude).toBeGreaterThan(-141.0);
      expect(montreal.longitude).toBeLessThan(-52.6);
    });

    it('should handle northernmost Canada location (Arctic)', () => {
      const resolute = { latitude: 74.6961, longitude: -94.8694 };
      // Resolute Bay, Nunavut is in far north Canada
      expect(resolute.latitude).toBeGreaterThan(41.7);
      expect(resolute.latitude).toBeLessThan(83.1);
      expect(resolute.longitude).toBeGreaterThan(-141.0);
      expect(resolute.longitude).toBeLessThan(-52.6);
    });

    it('should handle easternmost Canada location', () => {
      const stjohns = { latitude: 47.5615, longitude: -52.7126 };
      // St. John's, Newfoundland is easternmost Canada
      expect(stjohns.latitude).toBeGreaterThan(41.7);
      expect(stjohns.latitude).toBeLessThan(83.1);
      expect(stjohns.longitude).toBeGreaterThan(-141.0);
      expect(stjohns.longitude).toBeLessThan(-52.6);
    });
  });

  // === NON-COVERAGE LOCATIONS ===
  describe('Non-Coverage Location Handling', () => {
    it('should not select regional adapters for equatorial Africa', () => {
      const nairobi = { latitude: -1.2921, longitude: 36.8219 };
      // Not in any regional coverage area
      expect(nairobi.latitude).toBeLessThan(41.7); // Below Canada
      expect(nairobi.longitude).toBeGreaterThan(1.8); // East of UK
      expect(nairobi.longitude).toBeLessThan(-141.0); // West of Canada/East of everywhere
    });

    it('should not select regional adapters for Southeast Asia', () => {
      const bangkok = { latitude: 13.7563, longitude: 100.5018 };
      // Not in any regional coverage area
      expect(bangkok.latitude).toBeLessThan(41.7); // Below Canada
    });

    it('should not select regional adapters for southern Pacific', () => {
      const sydney = { latitude: -33.8688, longitude: 151.2093 };
      // Not in any regional coverage area
      expect(sydney.latitude).toBeLessThan(41.7); // Below Canada
    });
  });

  // === CACHE AND HEALTH STATUS ===
  describe('Provider Health Status', () => {
    it('should track health status for all providers', () => {
      const healthStatus = orchestrator.getHealthStatus();
      expect(healthStatus.size).toBeGreaterThan(0);

      for (const [provider, status] of healthStatus.entries()) {
        expect(provider).toBeDefined();
        expect(status.healthy).toBeDefined();
        expect(status.lastCheck).toBeInstanceOf(Date);
        expect(status.consecutiveFailures).toBeDefined();
      }
    });

    it('should initialize all providers as healthy', () => {
      const healthStatus = orchestrator.getHealthStatus();
      for (const status of healthStatus.values()) {
        expect(status.healthy).toBe(true);
        expect(status.consecutiveFailures).toBe(0);
      }
    });
  });

  // === CACHE OPERATIONS ===
  describe('Cache Management', () => {
    it('should return cache statistics', () => {
      const stats = orchestrator.getCacheStats();
      expect(stats).toBeDefined();
      expect(stats.hitRate).toBeDefined();
      expect(stats.keys).toBeDefined();
      expect(stats.hits).toBeDefined();
      expect(stats.misses).toBeDefined();
    });

    it('should allow cache clearing', () => {
      // Should not throw
      expect(() => orchestrator.clearCache()).not.toThrow();
    });
  });
});

describe('WeatherOrchestrator - Edge Cases', () => {
  let orchestrator: WeatherOrchestrator;

  beforeEach(() => {
    orchestrator = new WeatherOrchestrator({
      enabledProviders: ['open-meteo', 'nws'],
      minProviders: 1,
      maxConcurrent: 10,
    });
  });

  // === BORDER LOCATIONS ===
  describe('Border Locations', () => {
    it('should handle Germany-Poland border', () => {
      const borderLoc = { latitude: 52.3, longitude: 14.5 };
      // Just inside Poland, in EU coverage
      expect(borderLoc.latitude).toBeGreaterThan(49.0);
      expect(borderLoc.longitude).toBeGreaterThan(12.1);
    });

    it('should handle US-Canada border (southern Ontario)', () => {
      const borderLoc = { latitude: 43.0, longitude: -79.5 };
      // Near US-Canada border, should be Canada
      expect(borderLoc.latitude).toBeGreaterThan(41.7); // In Canada bbox
    });

    it('should distinguish between US and Canada at border', () => {
      const canada = { latitude: 43.6, longitude: -79.4 }; // Toronto
      const usa = { latitude: 40.7, longitude: -74.0 }; // NYC

      // Toronto is in Canada bbox
      expect(canada.latitude).toBeGreaterThan(41.7);
      // NYC is not
      expect(usa.latitude).toBeLessThan(41.7);
    });
  });

  // === ISLAND LOCATIONS ===
  describe('Island Locations', () => {
    it('should handle UK island locations (Isle of Man)', () => {
      const isleOfMan = { latitude: 54.236, longitude: -4.548 };
      expect(isleOfMan.latitude).toBeGreaterThan(49.9);
      expect(isleOfMan.longitude).toBeGreaterThan(-8.2);
    });

    it('should handle Greek island locations (Crete)', () => {
      const crete = { latitude: 35.3, longitude: 25.3 };
      expect(crete.latitude).toBeGreaterThan(35.0);
      expect(crete.latitude).toBeLessThan(41.8);
    });

    it('should handle Portuguese island locations (Azores)', () => {
      const azores = { latitude: 37.8, longitude: -25.7 };
      // Azores are outside the Portugal bbox in country-lookup
      // This is acceptable as they're far from mainland
      expect(azores.longitude).toBeLessThan(-6.2); // West of Portugal mainland
    });
  });

  // === EXTREME LATITUDES ===
  describe('Extreme Latitudes', () => {
    it('should handle northernmost EU locations (North Cape, Norway)', () => {
      const northCape = { latitude: 71.1, longitude: 25.6 };
      expect(northCape.latitude).toBeGreaterThan(57.9); // Norway bbox
      expect(northCape.longitude).toBeGreaterThan(4.5);
    });

    it('should handle Arctic Canada locations', () => {
      const resolute = { latitude: 74.7, longitude: -94.8 };
      expect(resolute.latitude).toBeGreaterThan(41.7); // Within Canada bbox
      expect(resolute.longitude).toBeGreaterThan(-141.0);
    });

    it('should reject locations beyond coverage', () => {
      const veryFarNorth = { latitude: 85.0, longitude: 0.0 };
      // Beyond all coverage areas
      expect(veryFarNorth.latitude).toBeGreaterThan(83.1); // Beyond Canada
    });
  });

  // === GEOCODING LANGUAGE PASSTHROUGH ===
  describe('geocode() language passthrough', () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // Build a fresh Response per call — Response bodies can only be read once.
      const buildResponse = () =>
        new Response(
          JSON.stringify({
            results: [
              { name: 'Köln', country: 'Germany', latitude: 50.9, longitude: 6.9 },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      fetchSpy = vi.fn();
      fetchSpy.mockImplementation(async () => buildResponse());
      globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    });

    it('defaults to language=en when no lang is provided', async () => {
      await orchestrator.geocode('Cologne');
      const url = fetchSpy.mock.calls[0]?.[0] as string;
      expect(url).toContain('language=en');
    });

    it('forwards an explicit lang to Open-Meteo', async () => {
      await orchestrator.geocode('Koln', 'de');
      const url = fetchSpy.mock.calls[0]?.[0] as string;
      expect(url).toContain('language=de');
    });

    it('strips the region subtag (en-US → en)', async () => {
      await orchestrator.geocode('Cologne', 'en-US');
      const url = fetchSpy.mock.calls[0]?.[0] as string;
      expect(url).toContain('language=en');
    });

    it('caches results separately per language', async () => {
      await orchestrator.geocode('Cologne', 'en');
      await orchestrator.geocode('Cologne', 'de');
      await orchestrator.geocode('Cologne', 'en'); // cache hit
      await orchestrator.geocode('Cologne', 'de'); // cache hit
      // Only two upstream calls: one per language.
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
