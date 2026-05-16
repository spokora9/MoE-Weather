/**
 * Tests for country-lookup location helpers
 * Covers EU, UK, and Canada location detection with edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  isEULocation,
  isUKLocation,
  isCanadaLocation,
  getCountryCode,
} from '../country-lookup.js';

describe('Country Lookup - EU Location Detection', () => {
  // === CORE EU LOCATIONS ===
  it('should return true for Berlin, Germany', () => {
    expect(isEULocation(52.5, 13.4)).toBe(true);
  });

  it('should return true for Paris, France', () => {
    expect(isEULocation(48.8, 2.3)).toBe(true);
  });

  it('should return true for Vienna, Austria', () => {
    expect(isEULocation(48.2, 16.4)).toBe(true);
  });

  it('should return true for Rome, Italy', () => {
    expect(isEULocation(41.9, 12.5)).toBe(true);
  });

  it('should return true for Barcelona, Spain', () => {
    expect(isEULocation(41.4, 2.2)).toBe(true);
  });

  it('should return true for Athens, Greece', () => {
    expect(isEULocation(37.9, 23.7)).toBe(true);
  });

  // === EDGE CASES: COUNTRY BORDERS ===
  it('should handle Germany-Poland border correctly', () => {
    // Just inside Poland (near Frankfurt/Oder)
    expect(isEULocation(52.3, 14.5)).toBe(true);
  });

  it('should handle Austria-Czech Republic border', () => {
    // Brno area (Czech)
    expect(isEULocation(49.2, 16.6)).toBe(true);
  });

  it('should handle France-Spain border', () => {
    // Just inside Spain (near Pyrenees)
    expect(isEULocation(42.8, 2.0)).toBe(true);
  });

  it('should handle Italy-Switzerland border', () => {
    // Just inside Italy
    expect(isEULocation(46.5, 10.0)).toBe(true);
  });

  // === EDGE CASES: ISLAND LOCATIONS ===
  it('should return true for Lisbon, Portugal (westernmost EU)', () => {
    expect(isEULocation(38.7, -9.1)).toBe(true);
  });

  it('should return true for Greek islands (Cyprus)', () => {
    expect(isEULocation(35.1, 33.4)).toBe(true);
  });

  it('should return true for Corsica, France', () => {
    expect(isEULocation(42.0, 9.0)).toBe(true);
  });

  it('should return true for Crete, Greece', () => {
    expect(isEULocation(35.2, 25.1)).toBe(true);
  });

  // === EDGE CASES: NORTHERN LOCATIONS ===
  it('should return true for Oslo, Norway', () => {
    expect(isEULocation(59.9, 10.8)).toBe(true);
  });

  it('should return true for Stockholm, Sweden', () => {
    expect(isEULocation(59.3, 18.1)).toBe(true);
  });

  it('should return true for Helsinki, Finland', () => {
    expect(isEULocation(60.2, 24.9)).toBe(true);
  });

  it('should return true for northern Norway (near Tromso)', () => {
    expect(isEULocation(69.0, 19.0)).toBe(true);
  });

  // === OUTSIDE EU ===
  it('should return false for New York, USA', () => {
    expect(isEULocation(40.7, -74.0)).toBe(false);
  });

  it('should return false for London (should use UK function)', () => {
    // London is in UK/Ireland bbox, but also technically outside EU country boxes
    // This tests that EU function doesn't pick it up
    expect(isEULocation(51.5, -0.1)).toBe(false);
  });

  it('should return false for Moscow, Russia', () => {
    expect(isEULocation(55.7, 37.6)).toBe(false);
  });

  it('should return false for Cairo, Egypt', () => {
    expect(isEULocation(30.0, 31.2)).toBe(false);
  });

  it('should return false for Tokyo, Japan', () => {
    expect(isEULocation(35.7, 139.7)).toBe(false);
  });

  // === COUNTRY CODE LOOKUPS ===
  it('should return DE for Berlin', () => {
    expect(getCountryCode(52.5, 13.4)).toBe('DE');
  });

  it('should return FR for Paris', () => {
    expect(getCountryCode(48.8, 2.3)).toBe('FR');
  });

  it('should return null for non-EU location', () => {
    expect(getCountryCode(40.7, -74.0)).toBeNull();
  });
});

describe('Country Lookup - UK Location Detection', () => {
  // === CORE UK LOCATIONS ===
  it('should return true for London, UK', () => {
    expect(isUKLocation(51.5, -0.1)).toBe(true);
  });

  it('should return true for Manchester, UK', () => {
    expect(isUKLocation(53.5, -2.2)).toBe(true);
  });

  it('should return true for Belfast, Northern Ireland', () => {
    expect(isUKLocation(54.6, -5.9)).toBe(true);
  });

  it('should return true for Edinburgh, Scotland', () => {
    expect(isUKLocation(55.9, -3.2)).toBe(true);
  });

  it('should return true for Dublin, Ireland', () => {
    expect(isUKLocation(53.3, -6.3)).toBe(true);
  });

  it('should return true for Cork, Ireland', () => {
    expect(isUKLocation(51.9, -8.5)).toBe(true);
  });

  // === ISLAND EDGE CASES ===
  it('should return true for Isle of Man', () => {
    expect(isUKLocation(54.2, -4.5)).toBe(true);
  });

  it('should return true for Channel Islands (Guernsey)', () => {
    expect(isUKLocation(49.5, -2.5)).toBe(true);
  });

  it('should return true for northernmost Scottish isles (Shetland)', () => {
    expect(isUKLocation(60.5, -1.3)).toBe(true);
  });

  it('should return true for southwestern Ireland (Dingle Peninsula)', () => {
    expect(isUKLocation(52.1, -9.9)).toBe(true);
  });

  // === LAND/SEA BORDERS ===
  it('should handle Scotland-England border', () => {
    expect(isUKLocation(55.8, -2.0)).toBe(true);
  });

  it('should handle Ireland-UK sea border (east coast Ireland)', () => {
    expect(isUKLocation(53.4, -5.5)).toBe(true);
  });

  // === OUTSIDE UK ===
  it('should return false for continental France', () => {
    expect(isUKLocation(48.8, 2.3)).toBe(false);
  });

  it('should return false for Netherlands', () => {
    expect(isUKLocation(52.1, 5.3)).toBe(false);
  });

  it('should return false for USA', () => {
    expect(isUKLocation(40.7, -74.0)).toBe(false);
  });
});

describe('Country Lookup - Canada Location Detection', () => {
  // === MAJOR CANADIAN CITIES ===
  it('should return true for Toronto, Canada', () => {
    expect(isCanadaLocation(43.6, -79.4)).toBe(true);
  });

  it('should return true for Vancouver, Canada', () => {
    expect(isCanadaLocation(49.3, -123.1)).toBe(true);
  });

  it('should return true for Montreal, Canada', () => {
    expect(isCanadaLocation(45.5, -73.6)).toBe(true);
  });

  it('should return true for Calgary, Canada', () => {
    expect(isCanadaLocation(51.0, -114.1)).toBe(true);
  });

  it('should return true for Ottawa, Canada', () => {
    expect(isCanadaLocation(45.4, -75.7)).toBe(true);
  });

  it('should return true for Winnipeg, Canada', () => {
    expect(isCanadaLocation(49.9, -97.1)).toBe(true);
  });

  // === PROVINCIAL EDGE CASES ===
  it('should return true for southernmost Ontario location (near Detroit)', () => {
    expect(isCanadaLocation(42.3, -83.0)).toBe(true);
  });

  it('should return true for Quebec City, Quebec', () => {
    expect(isCanadaLocation(46.8, -71.2)).toBe(true);
  });

  it('should return true for Halifax, Nova Scotia (east coast)', () => {
    expect(isCanadaLocation(44.6, -63.3)).toBe(true);
  });

  it('should return true for St. John\'s, Newfoundland (easternmost)', () => {
    expect(isCanadaLocation(47.6, -52.7)).toBe(true);
  });

  // === WESTERN EDGE CASES ===
  it('should return true for Whitehorse, Yukon (northwest)', () => {
    expect(isCanadaLocation(60.7, -135.0)).toBe(true);
  });

  it('should return true for Yellowknife, Northwest Territories', () => {
    expect(isCanadaLocation(62.4, -114.4)).toBe(true);
  });

  it('should return true for Inuvik, Northwest Territories (far north)', () => {
    expect(isCanadaLocation(68.4, -133.7)).toBe(true);
  });

  // === ARCTIC EDGE CASES ===
  it('should return true for northernmost Arctic location near pole', () => {
    // Northern tip of Canadian Arctic Islands
    expect(isCanadaLocation(83.0, -95.0)).toBe(true);
  });

  it('should return true for Resolute Bay, Nunavut (high Arctic)', () => {
    expect(isCanadaLocation(74.7, -94.8)).toBe(true);
  });

  // === WESTERN BOUNDARY EDGE CASE ===
  it('should return true for westernmost BC location (near Alaska)', () => {
    expect(isCanadaLocation(60.0, -140.9)).toBe(true);
  });

  // === OUTSIDE CANADA ===
  it('should return false for Seattle, USA', () => {
    expect(isCanadaLocation(47.6, -122.3)).toBe(false);
  });

  it('should return false for northern Alaska (too far west)', () => {
    expect(isCanadaLocation(70.0, -150.0)).toBe(false);
  });

  it('should return false for Greenland', () => {
    expect(isCanadaLocation(70.0, -40.0)).toBe(false);
  });

  it('should return false for Cuba', () => {
    expect(isCanadaLocation(21.5, -77.5)).toBe(false);
  });

  it('should return false for Tokyo, Japan', () => {
    expect(isCanadaLocation(35.7, 139.7)).toBe(false);
  });
});

describe('Country Lookup - Regional Separation', () => {
  // EU and UK should not overlap significantly
  it('should distinguish Berlin (EU) from London (UK)', () => {
    expect(isEULocation(52.5, 13.4)).toBe(true);
    expect(isUKLocation(52.5, 13.4)).toBe(false);
  });

  it('should distinguish Dublin (UK region) from Berlin (EU)', () => {
    expect(isUKLocation(53.3, -6.3)).toBe(true);
    expect(isEULocation(53.3, -6.3)).toBe(false);
  });

  it('should distinguish Toronto (Canada) from NY (USA)', () => {
    expect(isCanadaLocation(43.6, -79.4)).toBe(true);
    expect(isCanadaLocation(40.7, -74.0)).toBe(false);
  });

  it('should not confuse Canada with Europe', () => {
    expect(isCanadaLocation(45.5, -73.6)).toBe(true);
    expect(isEULocation(45.5, -73.6)).toBe(false);
  });
});
