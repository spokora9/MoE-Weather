/**
 * Weather API Adapters Index
 * Export all adapters for easy importing
 */

export { WeatherAdapter, fetchWithRetry } from './base.js';
export type { AdapterConfig, AdapterResponse, QuotaInfo } from './base.js';

export { OpenMeteoAdapter } from './open-meteo.js';
export { NWSAdapter } from './nws.js';
export { OpenWeatherMapAdapter } from './openweathermap.js';
export { WeatherAPIAdapter } from './weatherapi.js';
