/**
 * Tests for ConsensusEngine provider weights (Wave 2 Track D - D2)
 *
 * Focus: verify that the five new Wave 1 providers have explicit, well-formed
 * weight entries and that location-aware adjustments behave correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConsensusEngine } from '../consensus.js';
import type { WeatherProvider } from '../../types/weather.js';
import type { AdapterResponse } from '../../adapters/base.js';

describe('ConsensusEngine - New Provider Weights (Wave 1 additions)', () => {
  let engine: ConsensusEngine;

  beforeEach(() => {
    engine = new ConsensusEngine();
  });

  describe('Tomorrow.io', () => {
    it('has a default weight at or above 0.25 on standard metrics', () => {
      const metrics = ['temperature', 'wind', 'humidity', 'pressure', 'cloudCover'];
      for (const m of metrics) {
        expect(engine.getWeight('tomorrow-io', m)).toBeGreaterThanOrEqual(0.25);
      }
    });

    it('has premium weight (>=0.40) for nowcast / precipitation_60min', () => {
      expect(engine.getWeight('tomorrow-io', 'precipitation_60min')).toBeGreaterThanOrEqual(0.4);
      expect(engine.getWeight('tomorrow-io', 'nowcast')).toBeGreaterThanOrEqual(0.4);
    });

    it('has elevated precipitation weight above default 0.25', () => {
      expect(engine.getWeight('tomorrow-io', 'precipitation')).toBeGreaterThan(0.25);
    });
  });

  describe('Pirate Weather', () => {
    it('has 0.15 default on all standard metrics', () => {
      const metrics = ['temperature', 'precipitation', 'wind', 'humidity', 'pressure'];
      for (const m of metrics) {
        expect(engine.getWeight('pirate-weather', m)).toBe(0.15);
      }
    });

    it('does not exceed the more authoritative providers', () => {
      // Pirate Weather should weigh less than NWS, Open-Meteo, ECCC for temperature
      expect(engine.getWeight('pirate-weather', 'temperature')).toBeLessThan(
        engine.getWeight('open-meteo', 'temperature')
      );
      expect(engine.getWeight('pirate-weather', 'temperature')).toBeLessThan(
        engine.getWeight('eccc-canada', 'temperature')
      );
    });
  });

  describe('ECCC Canada', () => {
    it('has 0.30 default for primary metrics', () => {
      expect(engine.getWeight('eccc-canada', 'temperature')).toBe(0.3);
      expect(engine.getWeight('eccc-canada', 'precipitation')).toBe(0.3);
      expect(engine.getWeight('eccc-canada', 'wind')).toBe(0.3);
    });

    it('boosts temperature weight to >=0.40 inside Canadian coordinates', () => {
      // Toronto
      const w = engine.getLocationAdjustedWeight(
        'eccc-canada',
        'temperature',
        43.6532,
        -79.3832
      );
      expect(w).toBeGreaterThanOrEqual(0.4);
    });

    it('boosts wind weight to >=0.40 inside Canadian coordinates', () => {
      // Vancouver
      const w = engine.getLocationAdjustedWeight(
        'eccc-canada',
        'wind',
        49.2827,
        -123.1207
      );
      expect(w).toBeGreaterThanOrEqual(0.4);
    });

    it('does NOT boost weight outside Canada', () => {
      // New York City - clearly outside the Canadian bbox
      const w = engine.getLocationAdjustedWeight(
        'eccc-canada',
        'temperature',
        40.7128,
        -74.006
      );
      expect(w).toBe(0.3);
    });

    it('does not over-boost unrelated metrics', () => {
      // UV index should NOT receive a Canada bump
      const w = engine.getLocationAdjustedWeight(
        'eccc-canada',
        'uvIndex',
        43.6532,
        -79.3832
      );
      expect(w).toBeLessThan(0.4);
    });
  });

  describe('MeteoAlarm', () => {
    it('has a low default weight of 0.10 on numeric metrics', () => {
      // MeteoAlarm is alerts-only; numeric weight must stay low.
      const metrics = ['temperature', 'precipitation', 'wind', 'humidity', 'pressure'];
      for (const m of metrics) {
        expect(engine.getWeight('meteo-alarm', m)).toBe(0.1);
      }
    });

    it('is dominated by every numerical provider for temperature', () => {
      const providers: WeatherProvider[] = [
        'open-meteo',
        'nws',
        'openweathermap',
        'weatherapi',
        'tomorrow-io',
        'bright-sky',
        'met-norway',
        'eccc-canada',
      ];
      for (const p of providers) {
        expect(engine.getWeight(p, 'temperature')).toBeGreaterThan(
          engine.getWeight('meteo-alarm', 'temperature')
        );
      }
    });
  });

  describe('NOAA Tides', () => {
    it('has zero weight on every weather metric', () => {
      const metrics = [
        'temperature',
        'precipitation',
        'precipitation_60min',
        'nowcast',
        'wind',
        'humidity',
        'pressure',
        'uvIndex',
        'cloudCover',
        'visibility',
      ];
      for (const m of metrics) {
        expect(engine.getWeight('noaa-tides', m)).toBe(0);
      }
    });

    it('contributes nothing to a weighted average when included', () => {
      // Build a minimal multi-provider current-weather aggregation in which
      // noaa-tides appears with an extreme outlier temperature; the final
      // temperature should not move because its weight is zero.
      const now = new Date();
      const baseResponse = (
        provider: WeatherProvider,
        temperature: number
      ): {
        provider: WeatherProvider;
        data: AdapterResponse;
        timestamp: Date;
      } => ({
        provider,
        data: {
          current: {
            temperature,
            feelsLike: temperature,
            humidity: 50,
            pressure: 1013,
            windSpeed: 5,
            windDirection: 180,
            visibility: 10000,
            cloudCover: 50,
            weatherCode: 1 as never,
            weatherDescription: 'mainly clear',
            timestamp: now,
          },
          raw: {
            provider,
            fetchedAt: now,
            responseTime: 100,
            response: {},
          } as never,
        } as never,
        timestamp: now,
      });

      const withoutTides = engine.aggregateCurrentWeather([
        baseResponse('open-meteo', 20),
        baseResponse('nws', 21),
      ]);
      const withTides = engine.aggregateCurrentWeather([
        baseResponse('open-meteo', 20),
        baseResponse('nws', 21),
        baseResponse('noaa-tides', 999), // wildly out-of-range
      ]);

      expect(withoutTides).not.toBeNull();
      expect(withTides).not.toBeNull();
      // Tides' value must not pull the average — zero weight.
      // (Outlier detection may also drop it, which is equally acceptable.)
      expect(Math.abs(withTides!.data.temperature - withoutTides!.data.temperature)).toBeLessThan(
        1
      );
    });
  });

  describe('Weight table integrity', () => {
    it('returns the default fallback (0.1) for unknown providers', () => {
      // 'cached' has no entry; should fall back to 0.1
      expect(engine.getWeight('cached', 'temperature')).toBe(0.1);
    });

    it('allows runtime overrides via updateProviderWeights', () => {
      engine.updateProviderWeights('pirate-weather', { temperature: 0.5 });
      expect(engine.getWeight('pirate-weather', 'temperature')).toBe(0.5);
      // Other metrics should be unchanged
      expect(engine.getWeight('pirate-weather', 'wind')).toBe(0.15);
    });

    it('exposes weight for every Wave 1 provider explicitly (no fallback)', () => {
      // If the entry is missing we'd get 0.1 from the fallback. We pick a
      // metric value that is *not* 0.1 in our explicit table for each
      // provider so a missing entry would be detectable.
      expect(engine.getWeight('tomorrow-io', 'precipitation_60min')).not.toBe(0.1);
      expect(engine.getWeight('pirate-weather', 'temperature')).not.toBe(0.1);
      expect(engine.getWeight('eccc-canada', 'temperature')).not.toBe(0.1);
      expect(engine.getWeight('noaa-tides', 'temperature')).toBe(0); // explicit zero
      // meteo-alarm intentionally equals the fallback (0.10) but is documented.
      expect(engine.getWeight('meteo-alarm', 'temperature')).toBe(0.1);
    });
  });
});
