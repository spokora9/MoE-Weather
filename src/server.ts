/**
 * MoE Weather API Server
 * Express-based REST API for weather data
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { z } from 'zod';
import { WeatherOrchestrator } from './engine/orchestrator.js';
import type { WeatherRequest } from './types/weather.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validation schemas
const weatherQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  units: z.enum(['metric', 'imperial']).optional().default('metric'),
  hourly: z.coerce.number().min(1).max(168).optional().default(48),
  daily: z.coerce.number().min(1).max(14).optional().default(7),
  alerts: z.coerce.boolean().optional().default(true),
});

const geocodeQuerySchema = z.object({
  q: z.string().min(2).max(100),
});

const historicalQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  days: z.coerce.number().min(7).max(30).optional().default(10),
});

// Initialize orchestrator
const orchestrator = new WeatherOrchestrator({
  apiKeys: {
    openWeatherMap: process.env.OPENWEATHERMAP_API_KEY,
    weatherApi: process.env.WEATHERAPI_KEY,
    tomorrowIo: process.env.TOMORROW_IO_API_KEY,
  },
});

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors());
app.use(compression());
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

app.use('/api/', apiLimiter);

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const healthStatus = await orchestrator.runHealthChecks();
    const cacheStats = orchestrator.getCacheStats();

    const providers = Array.from(healthStatus.entries()).map(
      ([name, healthy]) => ({ name, healthy })
    );

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      providers,
      cache: cacheStats,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: (error as Error).message,
    });
  }
});

// Weather endpoint
app.get('/api/weather', async (req: Request, res: Response) => {
  try {
    const query = weatherQuerySchema.parse(req.query);

    const request: WeatherRequest = {
      latitude: query.lat,
      longitude: query.lon,
      units: query.units,
      hourlyHours: query.hourly,
      dailyDays: query.daily,
      includeAlerts: query.alerts,
    };

    const weather = await orchestrator.getWeather(request);

    // Convert units if needed
    if (query.units === 'imperial') {
      convertToImperial(weather);
    }

    res.json(weather);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    } else {
      console.error('[API] Weather error:', error);
      res.status(500).json({
        error: 'Failed to fetch weather data',
        message: (error as Error).message,
      });
    }
  }
});

// Geocoding endpoint
app.get('/api/geocode', async (req: Request, res: Response) => {
  try {
    const query = geocodeQuerySchema.parse(req.query);
    const results = await orchestrator.geocode(query.q);
    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    } else {
      console.error('[API] Geocode error:', error);
      res.status(500).json({
        error: 'Failed to geocode location',
        message: (error as Error).message,
      });
    }
  }
});

// Air Quality endpoint (Open-Meteo Air Quality API)
const airQualityQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

app.get('/api/air-quality', async (req: Request, res: Response) => {
  try {
    const query = airQualityQuerySchema.parse(req.query);

    const params = new URLSearchParams({
      latitude: query.lat.toString(),
      longitude: query.lon.toString(),
      current: [
        'us_aqi',
        'european_aqi',
        'pm10',
        'pm2_5',
        'carbon_monoxide',
        'nitrogen_dioxide',
        'sulphur_dioxide',
        'ozone',
        'dust',
        'uv_index',
        'ammonia',
        'alder_pollen',
        'birch_pollen',
        'grass_pollen',
        'mugwort_pollen',
        'olive_pollen',
        'ragweed_pollen',
      ].join(','),
      hourly: [
        'us_aqi',
        'pm2_5',
        'pm10',
        'uv_index',
      ].join(','),
      forecast_days: '3',
      timezone: 'auto',
    });

    const response = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`
    );

    if (!response.ok) {
      throw new Error(`Air Quality API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      current?: Record<string, number>;
      hourly?: Record<string, number[]>;
      [key: string]: unknown;
    };

    // Add AQI category labels
    const aqiData = {
      ...data,
      current: data.current ? {
        ...data.current,
        us_aqi_label: getAqiLabel(data.current.us_aqi || 0),
        us_aqi_color: getAqiColor(data.current.us_aqi || 0),
        health_recommendation: getHealthRecommendation(data.current.us_aqi || 0),
        pollen_risk: getPollenRisk(data.current),
      } : null,
    };

    res.json(aqiData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    } else {
      console.error('[API] Air Quality error:', error);
      res.status(500).json({
        error: 'Failed to fetch air quality data',
        message: (error as Error).message,
      });
    }
  }
});

// Historical averages endpoint (Open-Meteo Historical API)
app.get('/api/historical', async (req: Request, res: Response) => {
  try {
    const query = historicalQuerySchema.parse(req.query);

    // Calculate date range (past N days)
    // Note: Archive API has ~5 day delay, so end 7 days ago to ensure data availability
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 7); // 7 days ago (archive delay)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - query.days - 7);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const params = new URLSearchParams({
      latitude: query.lat.toString(),
      longitude: query.lon.toString(),
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'temperature_2m_mean',
        'precipitation_sum',
        'rain_sum',
        'snowfall_sum',
        'precipitation_hours',
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'wind_direction_10m_dominant',
        'shortwave_radiation_sum',
        'et0_fao_evapotranspiration',
      ].join(','),
      hourly: [
        'relative_humidity_2m',
        'pressure_msl',
        'cloud_cover',
      ].join(','),
      timezone: 'auto',
    });

    const response = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?${params}`
    );

    if (!response.ok) {
      throw new Error(`Historical API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      daily?: {
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        temperature_2m_mean?: number[];
        precipitation_sum?: number[];
        wind_speed_10m_max?: number[];
      };
      hourly?: {
        relative_humidity_2m?: number[];
        pressure_msl?: number[];
        cloud_cover?: number[];
      };
    };

    // Calculate averages
    const calcAvg = (arr?: number[]) => {
      if (!arr || arr.length === 0) return null;
      const valid = arr.filter(v => v !== null && v !== undefined);
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };

    const averages = {
      period_days: query.days,
      temperature: {
        avg_high: calcAvg(data.daily?.temperature_2m_max),
        avg_low: calcAvg(data.daily?.temperature_2m_min),
        avg_mean: calcAvg(data.daily?.temperature_2m_mean),
      },
      humidity: {
        avg: calcAvg(data.hourly?.relative_humidity_2m),
      },
      pressure: {
        avg: calcAvg(data.hourly?.pressure_msl),
      },
      precipitation: {
        avg_daily: calcAvg(data.daily?.precipitation_sum),
        total: data.daily?.precipitation_sum?.reduce((a, b) => a + (b || 0), 0) || 0,
      },
      wind: {
        avg_max: calcAvg(data.daily?.wind_speed_10m_max),
      },
      cloud_cover: {
        avg: calcAvg(data.hourly?.cloud_cover),
      },
      raw: data,
    };

    res.json(averages);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    } else {
      console.error('[API] Historical error:', error);
      res.status(500).json({
        error: 'Failed to fetch historical data',
        message: (error as Error).message,
      });
    }
  }
});

// Helper functions for Air Quality
function getAqiLabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

function getAqiColor(aqi: number): string {
  if (aqi <= 50) return '#00e400';
  if (aqi <= 100) return '#ffff00';
  if (aqi <= 150) return '#ff7e00';
  if (aqi <= 200) return '#ff0000';
  if (aqi <= 300) return '#8f3f97';
  return '#7e0023';
}

function getHealthRecommendation(aqi: number): string {
  if (aqi <= 50) return 'Air quality is good. Enjoy outdoor activities!';
  if (aqi <= 100) return 'Acceptable air quality. Unusually sensitive people should limit prolonged outdoor exertion.';
  if (aqi <= 150) return 'Sensitive groups should reduce prolonged outdoor exertion.';
  if (aqi <= 200) return 'Everyone should reduce prolonged outdoor exertion. Sensitive groups should avoid outdoor activities.';
  if (aqi <= 300) return 'Everyone should avoid prolonged outdoor exertion. Sensitive groups should remain indoors.';
  return 'Health alert! Everyone should avoid all outdoor activities.';
}

function getPollenRisk(current: Record<string, number>): { level: string; types: string[] } {
  const pollenTypes: string[] = [];
  let maxPollen = 0;

  const pollenFields = [
    { key: 'alder_pollen', name: 'Alder' },
    { key: 'birch_pollen', name: 'Birch' },
    { key: 'grass_pollen', name: 'Grass' },
    { key: 'mugwort_pollen', name: 'Mugwort' },
    { key: 'olive_pollen', name: 'Olive' },
    { key: 'ragweed_pollen', name: 'Ragweed' },
  ];

  for (const { key, name } of pollenFields) {
    const value = current[key];
    if (value && value > 10) {
      pollenTypes.push(name);
      maxPollen = Math.max(maxPollen, value);
    }
  }

  let level = 'Low';
  if (maxPollen > 100) level = 'Very High';
  else if (maxPollen > 50) level = 'High';
  else if (maxPollen > 20) level = 'Moderate';

  return { level, types: pollenTypes };
}

// Marine/Ocean API endpoint (waves, tides, sea conditions)
const marineQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

app.get('/api/marine', async (req: Request, res: Response) => {
  try {
    const query = marineQuerySchema.parse(req.query);

    const params = new URLSearchParams({
      latitude: query.lat.toString(),
      longitude: query.lon.toString(),
      current: [
        'wave_height',
        'wave_direction',
        'wave_period',
        'wind_wave_height',
        'wind_wave_direction',
        'wind_wave_period',
        'swell_wave_height',
        'swell_wave_direction',
        'swell_wave_period',
      ].join(','),
      hourly: [
        'wave_height',
        'wave_direction',
        'wave_period',
        'swell_wave_height',
        'swell_wave_period',
      ].join(','),
      daily: [
        'wave_height_max',
        'wave_direction_dominant',
        'wave_period_max',
      ].join(','),
      forecast_days: '7',
      timezone: 'auto',
    });

    const response = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?${params}`
    );

    if (!response.ok) {
      throw new Error(`Marine API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      current?: Record<string, number>;
      hourly?: Record<string, number[]>;
      daily?: Record<string, (number | string)[]>;
      [key: string]: unknown;
    };

    // Add surf conditions assessment
    const surfConditions = data.current ? getSurfConditions(
      data.current.wave_height as number,
      data.current.wave_period as number,
      data.current.swell_wave_height as number
    ) : null;

    // Calculate estimated tides based on lunar position
    const tides = calculateTides(query.lon);

    res.json({
      ...data,
      conditions: surfConditions,
      tides,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    } else {
      console.error('[API] Marine error:', error);
      res.status(500).json({
        error: 'Failed to fetch marine data',
        message: (error as Error).message,
      });
    }
  }
});

// Sun/Moon data endpoint
const astronomyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

app.get('/api/astronomy', async (req: Request, res: Response) => {
  try {
    const query = astronomyQuerySchema.parse(req.query);

    // Get sunrise/sunset from forecast API
    const params = new URLSearchParams({
      latitude: query.lat.toString(),
      longitude: query.lon.toString(),
      daily: [
        'sunrise',
        'sunset',
        'daylight_duration',
        'sunshine_duration',
        'uv_index_max',
      ].join(','),
      timezone: 'auto',
      forecast_days: '7',
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`
    );

    if (!response.ok) {
      throw new Error(`Astronomy API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      daily?: {
        time?: string[];
        sunrise?: string[];
        sunset?: string[];
        daylight_duration?: number[];
        sunshine_duration?: number[];
        uv_index_max?: number[];
      };
      [key: string]: unknown;
    };

    // Calculate moon phase (simplified algorithm)
    const moonPhase = getMoonPhase(new Date());

    // Calculate golden hour times
    const today = data.daily;
    const goldenHour = today?.sunrise?.[0] && today?.sunset?.[0] ? {
      morning: {
        start: today.sunrise[0],
        end: addMinutes(today.sunrise[0], 60),
      },
      evening: {
        start: addMinutes(today.sunset[0], -60),
        end: today.sunset[0],
      },
    } : null;

    res.json({
      daily: data.daily,
      moon: moonPhase,
      golden_hour: goldenHour,
      daylight_trend: calculateDaylightTrend(data.daily?.daylight_duration),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    } else {
      console.error('[API] Astronomy error:', error);
      res.status(500).json({
        error: 'Failed to fetch astronomy data',
        message: (error as Error).message,
      });
    }
  }
});

// Helper functions for Marine API
function getSurfConditions(waveHeight: number, wavePeriod: number, swellHeight: number): {
  rating: string;
  description: string;
  suitable_for: string[];
} {
  const totalWave = (waveHeight || 0) + (swellHeight || 0) * 0.5;

  if (totalWave < 0.3) {
    return {
      rating: 'Flat',
      description: 'Very calm waters, minimal wave activity',
      suitable_for: ['Swimming', 'Paddleboarding', 'Kayaking'],
    };
  } else if (totalWave < 1.0) {
    return {
      rating: 'Small',
      description: 'Light waves, good for beginners',
      suitable_for: ['Beginner surfing', 'Bodyboarding', 'Swimming'],
    };
  } else if (totalWave < 2.0) {
    return {
      rating: 'Medium',
      description: 'Moderate waves, fun conditions',
      suitable_for: ['Intermediate surfing', 'Bodyboarding'],
    };
  } else if (totalWave < 3.5) {
    return {
      rating: 'Large',
      description: 'Significant waves, experienced surfers only',
      suitable_for: ['Advanced surfing', 'Experienced swimmers'],
    };
  } else {
    return {
      rating: 'Very Large',
      description: 'Dangerous conditions, stay out of water',
      suitable_for: ['Expert surfers only', 'Shore watching'],
    };
  }
}

// Tide estimation based on lunar position
// Note: This is a simplified estimation. For accurate tides, use local tide station data.
function calculateTides(longitude: number): {
  high_tides: { time: string; height: string }[];
  low_tides: { time: string; height: string }[];
  note: string;
} {
  const now = new Date();

  // Calculate lunar transit time (simplified)
  // The moon crosses the meridian roughly 50 minutes later each day
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const lunarDayOffset = (dayOfYear * 50) % (24 * 60); // minutes

  // Adjust for longitude (4 minutes per degree)
  const longitudeOffset = longitude * 4;

  // High tide occurs roughly when moon is overhead or opposite
  // Base time in minutes from midnight UTC
  const baseHighTide = (lunarDayOffset + longitudeOffset + 720) % (24 * 60);

  // Convert to local time approximation
  const localOffset = now.getTimezoneOffset();

  // Calculate 4 tides (2 high, 2 low) - roughly 6h 12m apart
  const tideInterval = 6 * 60 + 12; // 6 hours 12 minutes

  const highTide1 = (baseHighTide - localOffset + 24 * 60) % (24 * 60);
  const highTide2 = (highTide1 + 2 * tideInterval) % (24 * 60);
  const lowTide1 = (highTide1 + tideInterval) % (24 * 60);
  const lowTide2 = (lowTide1 + 2 * tideInterval) % (24 * 60);

  const formatTideTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Sort and filter to show upcoming tides
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const allHighs = [highTide1, highTide2].sort((a, b) => a - b);
  const allLows = [lowTide1, lowTide2].sort((a, b) => a - b);

  return {
    high_tides: allHighs.map(t => ({
      time: formatTideTime(t),
      height: 'Est.',
    })),
    low_tides: allLows.map(t => ({
      time: formatTideTime(t),
      height: 'Est.',
    })),
    note: 'Estimated from lunar position. Check local tide tables for accuracy.',
  };
}

// Moon phase calculation
function getMoonPhase(date: Date): {
  phase: string;
  illumination: number;
  emoji: string;
  zodiac: { sign: string; emoji: string };
} {
  // Simplified moon phase calculation
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  let c = 0, e = 0, jd = 0, b = 0;

  if (month < 3) {
    c = 4716;
    e = 1;
  } else {
    c = 4716;
    e = -1;
  }

  jd = Math.floor(365.25 * (year + c)) + Math.floor(30.6001 * (month + e)) + day - 1524.5;
  const daysSinceNew = jd - 2451549.5;
  const newMoons = daysSinceNew / 29.53059;
  const phase = (newMoons - Math.floor(newMoons)) * 29.53059;

  let phaseName: string;
  let emoji: string;
  let illumination: number;

  if (phase < 1.85) {
    phaseName = 'New Moon';
    emoji = '🌑';
    illumination = 0;
  } else if (phase < 7.38) {
    phaseName = 'Waxing Crescent';
    emoji = '🌒';
    illumination = Math.round((phase - 1.85) / 5.53 * 50);
  } else if (phase < 9.23) {
    phaseName = 'First Quarter';
    emoji = '🌓';
    illumination = 50;
  } else if (phase < 14.77) {
    phaseName = 'Waxing Gibbous';
    emoji = '🌔';
    illumination = 50 + Math.round((phase - 9.23) / 5.54 * 50);
  } else if (phase < 16.61) {
    phaseName = 'Full Moon';
    emoji = '🌕';
    illumination = 100;
  } else if (phase < 22.15) {
    phaseName = 'Waning Gibbous';
    emoji = '🌖';
    illumination = 100 - Math.round((phase - 16.61) / 5.54 * 50);
  } else if (phase < 24.0) {
    phaseName = 'Last Quarter';
    emoji = '🌗';
    illumination = 50;
  } else {
    phaseName = 'Waning Crescent';
    emoji = '🌘';
    illumination = 50 - Math.round((phase - 24.0) / 5.53 * 50);
  }

  // Calculate zodiac sign for the moon
  const zodiac = getMoonZodiac(date);

  return { phase: phaseName, illumination, emoji, zodiac };
}

// Calculate which zodiac sign the moon is in
function getMoonZodiac(date: Date): { sign: string; emoji: string } {
  // Simplified calculation based on moon's position in the zodiac
  // The moon moves through all 12 signs in ~27.3 days (sidereal month)
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();

  // Calculate Julian Day
  let jd: number;
  if (month < 3) {
    jd = Math.floor(365.25 * (year - 1 + 4716)) + Math.floor(30.6001 * (month + 12 + 1)) + day - 1524.5;
  } else {
    jd = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day - 1524.5;
  }
  jd += hour / 24;

  // Calculate moon's mean longitude (simplified)
  const T = (jd - 2451545.0) / 36525;
  const L = (218.3164477 + 481267.88123421 * T) % 360;
  const moonLongitude = L < 0 ? L + 360 : L;

  // Determine zodiac sign (each sign is 30 degrees)
  const signIndex = Math.floor(moonLongitude / 30);
  const signs = [
    { sign: 'Aries', emoji: '♈' },
    { sign: 'Taurus', emoji: '♉' },
    { sign: 'Gemini', emoji: '♊' },
    { sign: 'Cancer', emoji: '♋' },
    { sign: 'Leo', emoji: '♌' },
    { sign: 'Virgo', emoji: '♍' },
    { sign: 'Libra', emoji: '♎' },
    { sign: 'Scorpio', emoji: '♏' },
    { sign: 'Sagittarius', emoji: '♐' },
    { sign: 'Capricorn', emoji: '♑' },
    { sign: 'Aquarius', emoji: '♒' },
    { sign: 'Pisces', emoji: '♓' },
  ];

  return signs[signIndex] || signs[0];
}

function addMinutes(timeStr: string, minutes: number): string {
  const date = new Date(timeStr);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function calculateDaylightTrend(daylightDurations?: number[]): string | null {
  if (!daylightDurations || daylightDurations.length < 2) return null;

  const today = daylightDurations[0];
  const tomorrow = daylightDurations[1];
  const diff = tomorrow - today;

  if (Math.abs(diff) < 30) {
    return 'Stable daylight hours';
  } else if (diff > 0) {
    return `Gaining ${Math.round(diff / 60)} min/day`;
  } else {
    return `Losing ${Math.round(Math.abs(diff) / 60)} min/day`;
  }
}

// Cache management endpoints
app.post('/api/cache/clear', (_req: Request, res: Response) => {
  orchestrator.clearCache();
  res.json({ message: 'Cache cleared' });
});

app.get('/api/cache/stats', (_req: Request, res: Response) => {
  const stats = orchestrator.getCacheStats();
  res.json(stats);
});

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Catch-all route for SPA
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Helper function to convert weather data to imperial units
function convertToImperial(weather: ReturnType<typeof orchestrator.getWeather> extends Promise<infer T> ? T : never): void {
  // Convert current weather
  if (weather.current) {
    weather.current.temperature = celsiusToFahrenheit(weather.current.temperature);
    weather.current.feelsLike = celsiusToFahrenheit(weather.current.feelsLike);
    weather.current.windSpeed = msToMph(weather.current.windSpeed);
    if (weather.current.windGust) {
      weather.current.windGust = msToMph(weather.current.windGust);
    }
    weather.current.visibility = metersToMiles(weather.current.visibility);
  }

  // Convert hourly forecasts
  for (const hour of weather.hourly) {
    hour.temperature = celsiusToFahrenheit(hour.temperature);
    hour.feelsLike = celsiusToFahrenheit(hour.feelsLike);
    hour.windSpeed = msToMph(hour.windSpeed);
    hour.precipitation = mmToInches(hour.precipitation);
  }

  // Convert daily forecasts
  for (const day of weather.daily) {
    day.temperatureMax = celsiusToFahrenheit(day.temperatureMax);
    day.temperatureMin = celsiusToFahrenheit(day.temperatureMin);
    day.windSpeed = msToMph(day.windSpeed);
    day.precipitation = mmToInches(day.precipitation);
  }
}

function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9/5 + 32) * 10) / 10;
}

function msToMph(ms: number): number {
  return Math.round(ms * 2.237 * 10) / 10;
}

function metersToMiles(m: number): number {
  return Math.round(m / 1609.34 * 10) / 10;
}

function mmToInches(mm: number): number {
  return Math.round(mm / 25.4 * 100) / 100;
}

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   🌤️  MoE Weather API Server                                         ║
║                                                                       ║
║   Server running at http://localhost:${PORT}                           ║
║                                                                       ║
║   Endpoints:                                                          ║
║   • GET  /api/weather?lat=&lon=     - Weather data                    ║
║   • GET  /api/geocode?q=            - Search locations                ║
║   • GET  /api/air-quality?lat=&lon= - Air quality & pollen            ║
║   • GET  /api/historical?lat=&lon=  - Historical averages             ║
║   • GET  /api/marine?lat=&lon=      - Waves, tides, surf conditions   ║
║   • GET  /api/astronomy?lat=&lon=   - Sun, moon, golden hour          ║
║   • GET  /api/health                - Health check                    ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  orchestrator.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down...');
  orchestrator.shutdown();
  process.exit(0);
});

export default app;
