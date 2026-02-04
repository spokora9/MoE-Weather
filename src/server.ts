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
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🌤️  MoE Weather API Server                                    ║
║                                                                  ║
║   Server running at http://localhost:${PORT}                      ║
║                                                                  ║
║   Endpoints:                                                     ║
║   • GET  /api/weather?lat=&lon=  - Get weather data              ║
║   • GET  /api/geocode?q=         - Search locations              ║
║   • GET  /api/health             - Health check                  ║
║   • GET  /api/cache/stats        - Cache statistics              ║
║   • POST /api/cache/clear        - Clear cache                   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
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
