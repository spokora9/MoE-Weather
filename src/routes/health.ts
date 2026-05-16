import { Router, type Request, type Response } from 'express';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('routes:health');
export const healthRouter = Router();

// Liveness: process is alive
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness: dependencies are reachable
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, { healthy: boolean; latencyMs?: number; error?: string }> = {};

  // Check Redis if configured
  if (process.env.REDIS_URL) {
    const start = Date.now();
    try {
      const { getRedisClient } = await import('../lib/redis.js');
      const client = getRedisClient();
      if (client) {
        await client.ping();
        checks.redis = { healthy: true, latencyMs: Date.now() - start };
      }
    } catch (err) {
      checks.redis = { healthy: false, error: (err as Error).message };
    }
  }

  // Check Open-Meteo (primary provider, always required)
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=51.5&longitude=-0.1&current=temperature_2m', { signal: ctrl.signal });
    clearTimeout(timeout);
    checks['open-meteo'] = { healthy: r.ok, latencyMs: Date.now() - start };
  } catch {
    checks['open-meteo'] = { healthy: false, error: 'timeout or network error' };
  }

  const allHealthy = Object.values(checks).every(c => c.healthy);
  const status = allHealthy ? 200 : 503;

  logger.info({ checks, status }, 'Health check');
  res.status(status).json({ status: allHealthy ? 'ready' : 'degraded', checks, timestamp: new Date().toISOString() });
});
