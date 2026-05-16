/**
 * Unit locale definitions, locale → default-units mapping, and conversion helpers.
 *
 * Conventions:
 *   - Locale 'metric'   → °C  + km/h + hPa + km   (most of the world / EU continental)
 *   - Locale 'imperial' → °F  + mph  + inHg + mi  (United States)
 *   - Locale 'uk'       → °C  + mph  + hPa + mi   (UK / Ireland — metric temp, imperial speed)
 *   - Locale 'canada'   → °C  + km/h + kPa + km   (Canada — metric, but pressure in kPa)
 *
 * Conversion-function inputs (from upstream orchestrator):
 *   - Temperature in Celsius
 *   - Wind speed in km/h
 *   - Pressure in hPa
 *   - Visibility in meters
 *
 * Default-locale resolution priority (overlapping bounding boxes):
 *   UK > US > Canada > EU > metric
 */

import { isEULocation, isUKLocation, isCanadaLocation } from './country-lookup.js';

export type UnitLocale = 'metric' | 'imperial' | 'uk' | 'canada';

export interface UnitLabels {
  temp: string;
  wind: string;
  pressure: string;
  visibility: string;
}

/**
 * Rough US bounding box (kept in sync with src/adapters/nws.ts).
 * Includes contiguous 48, Alaska, Hawaii, Puerto Rico, Guam.
 */
export function isUSLocation(lat: number, lon: number): boolean {
  const isContiguous = lat >= 24 && lat <= 49 && lon >= -125 && lon <= -66;
  const isAlaska = lat >= 51 && lat <= 72 && lon >= -180 && lon <= -130;
  const isHawaii = lat >= 18 && lat <= 29 && lon >= -161 && lon <= -154;
  const isPuertoRico = lat >= 17 && lat <= 19 && lon >= -68 && lon <= -65;
  const isGuam = lat >= 13 && lat <= 14 && lon >= 144 && lon <= 146;
  return isContiguous || isAlaska || isHawaii || isPuertoRico || isGuam;
}

/**
 * Heuristic: distinguishes Canada from the United States in the region where
 * the two countries' bounding boxes overlap. Country-level lat/lon lookups
 * are inherently coarse, so we partition by longitude band and use
 * province-aware latitude cutoffs.
 *
 * - West of -95° (Prairies / Rockies / BC): Canada starts at the 49th parallel.
 * - -95° to -75° (Ontario / Quebec south corridor): Canada starts at ~43° N
 *   (covers Toronto 43.65, Montreal 45.5, Ottawa 45.4). South of 43° is US.
 * - East of -75° (Maritimes / NY / New England border): Canada starts at ~45°
 *   (covers Quebec City, Halifax, Fredericton). South of 45° in this band is
 *   US (NYC at 40.7, Boston at 42.4, Portland ME at 43.66 all fall through).
 */
function isLikelyCanada(lat: number, lon: number): boolean {
  if (!isCanadaLocation(lat, lon)) return false;
  if (lon < -95) return lat >= 49;
  if (lon < -75) return lat >= 43;
  return lat >= 45;
}

/**
 * Returns the default unit locale for a given lat/lon position.
 *
 * Resolution priority (handles overlapping country bounding boxes):
 *   1. UK / Ireland → 'uk'
 *   2. Canada (using a discriminating heuristic that beats the US fallback) → 'canada'
 *   3. United States → 'imperial'
 *   4. Continental EU → 'metric'
 *   5. Anywhere else → 'metric'
 */
export function getDefaultUnitLocale(lat: number, lon: number): UnitLocale {
  if (isUKLocation(lat, lon)) return 'uk';
  if (isLikelyCanada(lat, lon)) return 'canada';
  if (isUSLocation(lat, lon)) return 'imperial';
  if (isEULocation(lat, lon)) return 'metric';
  return 'metric';
}

/**
 * Rounds a number to a fixed number of decimal places without floating-point drift.
 */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Convert Celsius to the locale's temperature unit.
 *   - imperial → Fahrenheit
 *   - metric, uk, canada → Celsius (passthrough, rounded)
 */
export function convertTemperature(celsius: number, unitLocale: UnitLocale): number {
  if (unitLocale === 'imperial') {
    return round(celsius * 9 / 5 + 32, 1);
  }
  return round(celsius, 1);
}

/**
 * Convert km/h to the locale's wind-speed unit.
 *   - imperial, uk → mph
 *   - metric, canada → km/h (passthrough, rounded)
 */
export function convertWindSpeed(kmh: number, unitLocale: UnitLocale): number {
  if (unitLocale === 'imperial' || unitLocale === 'uk') {
    return round(kmh * 0.621371, 1);
  }
  return round(kmh, 1);
}

/**
 * Convert hPa to the locale's pressure unit.
 *   - imperial → inHg (1 hPa = 0.02953 inHg)
 *   - canada → kPa (1 hPa = 0.1 kPa)
 *   - metric, uk → hPa
 */
export function convertPressure(hPa: number, unitLocale: UnitLocale): number {
  if (unitLocale === 'imperial') {
    return round(hPa * 0.02953, 2);
  }
  if (unitLocale === 'canada') {
    return round(hPa / 10, 2);
  }
  return round(hPa, 1);
}

/**
 * Convert meters to the locale's visibility unit.
 *   - imperial, uk → miles
 *   - metric, canada → km
 */
export function convertVisibility(meters: number, unitLocale: UnitLocale): number {
  if (unitLocale === 'imperial' || unitLocale === 'uk') {
    return round(meters / 1609.344, 1);
  }
  return round(meters / 1000, 1);
}

/**
 * Human-readable unit labels for the given locale, suitable for UI display.
 */
export function getUnitLabels(unitLocale: UnitLocale): UnitLabels {
  switch (unitLocale) {
    case 'imperial':
      return { temp: '°F', wind: 'mph', pressure: 'inHg', visibility: 'mi' };
    case 'uk':
      return { temp: '°C', wind: 'mph', pressure: 'hPa', visibility: 'mi' };
    case 'canada':
      return { temp: '°C', wind: 'km/h', pressure: 'kPa', visibility: 'km' };
    case 'metric':
    default:
      return { temp: '°C', wind: 'km/h', pressure: 'hPa', visibility: 'km' };
  }
}
