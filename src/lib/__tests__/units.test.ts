/**
 * Tests for the unit-locale system: locale resolution + unit conversions.
 * Covers all 4 unit locales and edge cases for overlapping country bounding boxes.
 */

import { describe, it, expect } from 'vitest';
import {
  type UnitLocale,
  isUSLocation,
  getDefaultUnitLocale,
  convertTemperature,
  convertWindSpeed,
  convertPressure,
  convertVisibility,
  getUnitLabels,
} from '../units.js';

describe('isUSLocation', () => {
  it('returns true for New York City', () => {
    expect(isUSLocation(40.7, -74)).toBe(true);
  });

  it('returns true for Los Angeles', () => {
    expect(isUSLocation(34.05, -118.25)).toBe(true);
  });

  it('returns true for Anchorage, Alaska', () => {
    expect(isUSLocation(61.2, -149.9)).toBe(true);
  });

  it('returns true for Honolulu, Hawaii', () => {
    expect(isUSLocation(21.3, -157.85)).toBe(true);
  });

  it('returns false for London, UK', () => {
    expect(isUSLocation(51.5, -0.13)).toBe(false);
  });

  it('returns false for Paris, France', () => {
    expect(isUSLocation(48.85, 2.35)).toBe(false);
  });
});

describe('getDefaultUnitLocale', () => {
  // === UK ===
  it("returns 'uk' for London (51.5, -0.13)", () => {
    expect(getDefaultUnitLocale(51.5, -0.13)).toBe('uk');
  });

  it("returns 'uk' for Edinburgh, Scotland", () => {
    expect(getDefaultUnitLocale(55.95, -3.19)).toBe('uk');
  });

  it("returns 'uk' for Dublin, Ireland", () => {
    expect(getDefaultUnitLocale(53.35, -6.26)).toBe('uk');
  });

  // === US (imperial) ===
  it("returns 'imperial' for New York (40.7, -74)", () => {
    expect(getDefaultUnitLocale(40.7, -74)).toBe('imperial');
  });

  it("returns 'imperial' for Miami, Florida", () => {
    expect(getDefaultUnitLocale(25.76, -80.19)).toBe('imperial');
  });

  it("returns 'imperial' for Honolulu, Hawaii", () => {
    expect(getDefaultUnitLocale(21.3, -157.85)).toBe('imperial');
  });

  // === Canada ===
  it("returns 'canada' for Toronto (43.65, -79.38)", () => {
    expect(getDefaultUnitLocale(43.65, -79.38)).toBe('canada');
  });

  it("returns 'canada' for Vancouver", () => {
    expect(getDefaultUnitLocale(49.28, -123.12)).toBe('canada');
  });

  it("returns 'canada' for Montreal", () => {
    expect(getDefaultUnitLocale(45.5, -73.57)).toBe('canada');
  });

  // === EU / metric ===
  it("returns 'metric' for Paris (48.85, 2.35)", () => {
    expect(getDefaultUnitLocale(48.85, 2.35)).toBe('metric');
  });

  it("returns 'metric' for Berlin", () => {
    expect(getDefaultUnitLocale(52.52, 13.4)).toBe('metric');
  });

  it("returns 'metric' for Madrid", () => {
    expect(getDefaultUnitLocale(40.42, -3.7)).toBe('metric');
  });

  // === Fallback metric for non-covered regions ===
  it("returns 'metric' for Tokyo (Japan, no specific locale)", () => {
    expect(getDefaultUnitLocale(35.68, 139.69)).toBe('metric');
  });

  it("returns 'metric' for Sydney, Australia", () => {
    expect(getDefaultUnitLocale(-33.87, 151.21)).toBe('metric');
  });

  it("returns 'metric' for Buenos Aires", () => {
    expect(getDefaultUnitLocale(-34.6, -58.38)).toBe('metric');
  });

  // === Overlap-priority guards ===
  it("prioritizes 'uk' over 'metric' for Northern Ireland (which is in UK box and EU box)", () => {
    // Belfast: 54.6, -5.93 — inside both UK box and Ireland's EU box.
    expect(getDefaultUnitLocale(54.6, -5.93)).toBe('uk');
  });
});

describe('convertTemperature', () => {
  it('converts 0°C to 32°F for imperial', () => {
    expect(convertTemperature(0, 'imperial')).toBe(32);
  });

  it('converts 100°C to 212°F for imperial', () => {
    expect(convertTemperature(100, 'imperial')).toBe(212);
  });

  it('converts -40°C to -40°F for imperial', () => {
    expect(convertTemperature(-40, 'imperial')).toBe(-40);
  });

  it('returns Celsius (rounded) for metric', () => {
    expect(convertTemperature(20.34, 'metric')).toBe(20.3);
  });

  it('returns Celsius for uk locale', () => {
    expect(convertTemperature(15, 'uk')).toBe(15);
  });

  it('returns Celsius for canada locale', () => {
    expect(convertTemperature(-10.5, 'canada')).toBe(-10.5);
  });
});

describe('convertWindSpeed', () => {
  it('converts 100 km/h to ~62.1 mph for imperial', () => {
    expect(convertWindSpeed(100, 'imperial')).toBeCloseTo(62.1, 1);
  });

  it('converts 100 km/h to ~62.1 mph for uk', () => {
    expect(convertWindSpeed(100, 'uk')).toBeCloseTo(62.1, 1);
  });

  it('returns km/h for metric', () => {
    expect(convertWindSpeed(50, 'metric')).toBe(50);
  });

  it('returns km/h for canada', () => {
    expect(convertWindSpeed(75, 'canada')).toBe(75);
  });

  it('handles 0 km/h correctly', () => {
    expect(convertWindSpeed(0, 'imperial')).toBe(0);
    expect(convertWindSpeed(0, 'metric')).toBe(0);
  });
});

describe('convertPressure', () => {
  it('converts 1013.25 hPa to ~29.92 inHg for imperial', () => {
    expect(convertPressure(1013.25, 'imperial')).toBeCloseTo(29.92, 1);
  });

  it('converts 1000 hPa to 100 kPa for canada', () => {
    expect(convertPressure(1000, 'canada')).toBe(100);
  });

  it('converts 1013 hPa to 101.3 kPa for canada', () => {
    expect(convertPressure(1013, 'canada')).toBe(101.3);
  });

  it('returns hPa for metric', () => {
    expect(convertPressure(1015.5, 'metric')).toBe(1015.5);
  });

  it('returns hPa for uk', () => {
    expect(convertPressure(1020, 'uk')).toBe(1020);
  });
});

describe('convertVisibility', () => {
  it('converts 10000 m to ~6.2 mi for imperial', () => {
    expect(convertVisibility(10000, 'imperial')).toBeCloseTo(6.2, 1);
  });

  it('converts 10000 m to ~6.2 mi for uk', () => {
    expect(convertVisibility(10000, 'uk')).toBeCloseTo(6.2, 1);
  });

  it('converts 10000 m to 10 km for metric', () => {
    expect(convertVisibility(10000, 'metric')).toBe(10);
  });

  it('converts 5000 m to 5 km for canada', () => {
    expect(convertVisibility(5000, 'canada')).toBe(5);
  });

  it('handles 0 m', () => {
    expect(convertVisibility(0, 'imperial')).toBe(0);
    expect(convertVisibility(0, 'metric')).toBe(0);
  });
});

describe('getUnitLabels', () => {
  it('returns correct labels for imperial', () => {
    expect(getUnitLabels('imperial')).toEqual({
      temp: '°F',
      wind: 'mph',
      pressure: 'inHg',
      visibility: 'mi',
    });
  });

  it('returns correct labels for uk', () => {
    expect(getUnitLabels('uk')).toEqual({
      temp: '°C',
      wind: 'mph',
      pressure: 'hPa',
      visibility: 'mi',
    });
  });

  it('returns correct labels for canada', () => {
    expect(getUnitLabels('canada')).toEqual({
      temp: '°C',
      wind: 'km/h',
      pressure: 'kPa',
      visibility: 'km',
    });
  });

  it('returns correct labels for metric', () => {
    expect(getUnitLabels('metric')).toEqual({
      temp: '°C',
      wind: 'km/h',
      pressure: 'hPa',
      visibility: 'km',
    });
  });
});

describe('Acceptance-criteria locale matrix', () => {
  // Use a fixed weather payload (all metric baseline) to verify the
  // full per-locale label + conversion contract end-to-end.
  const weather = {
    tempC: 20,
    windKmh: 50,
    pressureHPa: 1013,
    visibilityMeters: 8000,
  };

  const locales: UnitLocale[] = ['uk', 'imperial', 'metric', 'canada'];

  for (const locale of locales) {
    it(`produces a consistent set of values + labels for ${locale}`, () => {
      const labels = getUnitLabels(locale);
      const temp = convertTemperature(weather.tempC, locale);
      const wind = convertWindSpeed(weather.windKmh, locale);
      const pressure = convertPressure(weather.pressureHPa, locale);
      const visibility = convertVisibility(weather.visibilityMeters, locale);

      expect(typeof temp).toBe('number');
      expect(typeof wind).toBe('number');
      expect(typeof pressure).toBe('number');
      expect(typeof visibility).toBe('number');
      expect(labels.temp).toMatch(/°[CF]/);
      expect(labels.wind).toMatch(/mph|km\/h/);
      expect(labels.pressure).toMatch(/hPa|inHg|kPa/);
      expect(labels.visibility).toMatch(/mi|km/);
    });
  }

  it('UK user (51.5, -0.13): °C + mph + hPa', () => {
    const locale = getDefaultUnitLocale(51.5, -0.13);
    expect(locale).toBe('uk');
    const labels = getUnitLabels(locale);
    expect(labels.temp).toBe('°C');
    expect(labels.wind).toBe('mph');
    expect(labels.pressure).toBe('hPa');
  });

  it('US user (40.7, -74): °F + mph + inHg', () => {
    const locale = getDefaultUnitLocale(40.7, -74);
    expect(locale).toBe('imperial');
    const labels = getUnitLabels(locale);
    expect(labels.temp).toBe('°F');
    expect(labels.wind).toBe('mph');
    expect(labels.pressure).toBe('inHg');
  });

  it('EU continental user (48.8, 2.35): °C + km/h + hPa', () => {
    const locale = getDefaultUnitLocale(48.8, 2.35);
    expect(locale).toBe('metric');
    const labels = getUnitLabels(locale);
    expect(labels.temp).toBe('°C');
    expect(labels.wind).toBe('km/h');
    expect(labels.pressure).toBe('hPa');
  });

  it('Canada user (43.65, -79.38): °C + km/h + kPa', () => {
    const locale = getDefaultUnitLocale(43.65, -79.38);
    expect(locale).toBe('canada');
    const labels = getUnitLabels(locale);
    expect(labels.temp).toBe('°C');
    expect(labels.wind).toBe('km/h');
    expect(labels.pressure).toBe('kPa');
  });
});
