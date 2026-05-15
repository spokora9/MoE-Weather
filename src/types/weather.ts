/**
 * Core weather data types for the MoE Weather System
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location {
  name: string;
  country: string;
  coordinates: Coordinates;
  timezone?: string;
}

export interface CurrentWeather {
  temperature: number; // Celsius
  feelsLike: number;
  humidity: number; // Percentage 0-100
  pressure: number; // hPa
  windSpeed: number; // m/s
  windDirection: number; // Degrees 0-360
  windGust?: number;
  visibility: number; // meters
  uvIndex?: number;
  cloudCover: number; // Percentage 0-100
  precipitation?: number; // mm
  weatherCode: WeatherCode;
  weatherDescription: string;
  timestamp: Date;
}

export interface HourlyForecast {
  time: Date;
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  windGust?: number;
  precipitation: number;
  rain?: number;
  showers?: number;
  snowfall?: number;
  precipitationProbability: number;
  weatherCode: WeatherCode;
  weatherDescription: string;
  cloudCover: number;
  uvIndex?: number;
  cape?: number; // Convective Available Potential Energy (storm energy)
  visibility?: number;
  freezingLevel?: number;
}

export interface DailyForecast {
  date: Date;
  temperatureMax: number;
  temperatureMin: number;
  temperatureMorning?: number;
  temperatureAfternoon?: number;
  temperatureEvening?: number;
  temperatureNight?: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust?: number;
  windDirection: number;
  precipitation: number;
  rain?: number;
  showers?: number;
  snowfall?: number;
  precipitationHours?: number;
  precipitationProbability: number;
  weatherCode: WeatherCode;
  weatherDescription: string;
  sunrise: Date;
  sunset: Date;
  uvIndex?: number;
}

export interface WeatherAlert {
  id: string;
  event: string;
  headline: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  urgency: 'immediate' | 'expected' | 'future' | 'past' | 'unknown';
  start: Date;
  end: Date;
  source: string;
}

export interface WeatherData {
  location: Location;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  alerts: WeatherAlert[];
  metadata: WeatherMetadata;
}

export interface WeatherMetadata {
  sources: SourceInfo[];
  confidence: ConfidenceScore;
  fetchedAt: Date;
  cacheExpiry: Date;
}

export interface SourceInfo {
  name: WeatherProvider;
  weight: number;
  responseTime: number; // ms
  dataFreshness: Date;
}

export interface ConfidenceScore {
  overall: number; // 0-1
  temperature: number;
  precipitation: number;
  wind: number;
  agreement: number; // How well sources agree
}

export type WeatherProvider =
  | 'open-meteo'
  | 'nws'
  | 'openweathermap'
  | 'weatherapi'
  | 'tomorrow-io'
  | 'bright-sky'
  | 'met-norway'
  | 'eccc-canada'
  | 'meteo-alarm'
  | 'pirate-weather'
  | 'noaa-tides'
  | 'cached';

export enum WeatherCode {
  // Clear
  CLEAR_SKY = 0,
  MAINLY_CLEAR = 1,
  PARTLY_CLOUDY = 2,
  OVERCAST = 3,

  // Fog
  FOG = 45,
  DEPOSITING_RIME_FOG = 48,

  // Drizzle
  LIGHT_DRIZZLE = 51,
  MODERATE_DRIZZLE = 53,
  DENSE_DRIZZLE = 55,
  LIGHT_FREEZING_DRIZZLE = 56,
  DENSE_FREEZING_DRIZZLE = 57,

  // Rain
  SLIGHT_RAIN = 61,
  MODERATE_RAIN = 63,
  HEAVY_RAIN = 65,
  LIGHT_FREEZING_RAIN = 66,
  HEAVY_FREEZING_RAIN = 67,

  // Snow
  SLIGHT_SNOW = 71,
  MODERATE_SNOW = 73,
  HEAVY_SNOW = 75,
  SNOW_GRAINS = 77,

  // Showers
  SLIGHT_RAIN_SHOWERS = 80,
  MODERATE_RAIN_SHOWERS = 81,
  VIOLENT_RAIN_SHOWERS = 82,
  SLIGHT_SNOW_SHOWERS = 85,
  HEAVY_SNOW_SHOWERS = 86,

  // Thunderstorm
  THUNDERSTORM = 95,
  THUNDERSTORM_SLIGHT_HAIL = 96,
  THUNDERSTORM_HEAVY_HAIL = 99,

  // Unknown
  UNKNOWN = -1,
}

export function getWeatherDescription(code: WeatherCode): string {
  const descriptions: Record<WeatherCode, string> = {
    [WeatherCode.CLEAR_SKY]: 'Clear sky',
    [WeatherCode.MAINLY_CLEAR]: 'Mainly clear',
    [WeatherCode.PARTLY_CLOUDY]: 'Partly cloudy',
    [WeatherCode.OVERCAST]: 'Overcast',
    [WeatherCode.FOG]: 'Fog',
    [WeatherCode.DEPOSITING_RIME_FOG]: 'Depositing rime fog',
    [WeatherCode.LIGHT_DRIZZLE]: 'Light drizzle',
    [WeatherCode.MODERATE_DRIZZLE]: 'Moderate drizzle',
    [WeatherCode.DENSE_DRIZZLE]: 'Dense drizzle',
    [WeatherCode.LIGHT_FREEZING_DRIZZLE]: 'Light freezing drizzle',
    [WeatherCode.DENSE_FREEZING_DRIZZLE]: 'Dense freezing drizzle',
    [WeatherCode.SLIGHT_RAIN]: 'Slight rain',
    [WeatherCode.MODERATE_RAIN]: 'Moderate rain',
    [WeatherCode.HEAVY_RAIN]: 'Heavy rain',
    [WeatherCode.LIGHT_FREEZING_RAIN]: 'Light freezing rain',
    [WeatherCode.HEAVY_FREEZING_RAIN]: 'Heavy freezing rain',
    [WeatherCode.SLIGHT_SNOW]: 'Slight snow',
    [WeatherCode.MODERATE_SNOW]: 'Moderate snow',
    [WeatherCode.HEAVY_SNOW]: 'Heavy snow',
    [WeatherCode.SNOW_GRAINS]: 'Snow grains',
    [WeatherCode.SLIGHT_RAIN_SHOWERS]: 'Slight rain showers',
    [WeatherCode.MODERATE_RAIN_SHOWERS]: 'Moderate rain showers',
    [WeatherCode.VIOLENT_RAIN_SHOWERS]: 'Violent rain showers',
    [WeatherCode.SLIGHT_SNOW_SHOWERS]: 'Slight snow showers',
    [WeatherCode.HEAVY_SNOW_SHOWERS]: 'Heavy snow showers',
    [WeatherCode.THUNDERSTORM]: 'Thunderstorm',
    [WeatherCode.THUNDERSTORM_SLIGHT_HAIL]: 'Thunderstorm with slight hail',
    [WeatherCode.THUNDERSTORM_HEAVY_HAIL]: 'Thunderstorm with heavy hail',
    [WeatherCode.UNKNOWN]: 'Unknown',
  };
  return descriptions[code] || 'Unknown';
}

// API Response types (raw from each provider)
export interface RawWeatherResponse {
  provider: WeatherProvider;
  data: unknown;
  fetchedAt: Date;
  responseTime: number;
}

// Request types
export interface WeatherRequest {
  latitude: number;
  longitude: number;
  units?: 'metric' | 'imperial';
  hourlyHours?: number; // How many hours of forecast
  dailyDays?: number; // How many days of forecast
  includeAlerts?: boolean;
}

// Geocoding types
export interface GeocodingResult {
  name: string;
  country: string;
  state?: string;
  latitude: number;
  longitude: number;
  population?: number;
}
