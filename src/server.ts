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
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - query.days);

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
║   • GET  /api/weather?lat=&lon=     - Get weather data                ║
║   • GET  /api/geocode?q=            - Search locations                ║
║   • GET  /api/air-quality?lat=&lon= - Air quality & pollen            ║
║   • GET  /api/historical?lat=&lon=  - Historical averages (10/30 day) ║
║   • GET  /api/health                - Health check                    ║
║   • GET  /api/cache/stats           - Cache statistics                ║
║   • POST /api/cache/clear           - Clear cache                     ║
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
