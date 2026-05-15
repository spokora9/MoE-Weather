import { type Request, type Response, type NextFunction } from 'express';
import { createLogger } from '../lib/logger.js';
import { metrics } from '../lib/metrics.js';

const logger = createLogger('middleware:rate-limit');

interface RateLimitEntry { count: number; resetAt: number; }
const store = new Map<string, RateLimitEntry>();

const LIMITS = {
  anonymous: { requests: 30, windowMs: 15 * 60 * 1000 },
  free:      { requests: 100, windowMs: 15 * 60 * 1000 },
  pro:       { requests: 1000, windowMs: 15 * 60 * 1000 },
} as const;

type Tier = keyof typeof LIMITS;

function getKey(req: Request, tier: Tier): string {
  // Use user ID if authenticated, IP otherwise
  const id = (req as any).user?.id || req.ip || 'unknown';
  return `ratelimit:${tier}:${id}`;
}

function checkLimit(key: string, limit: { requests: number; windowMs: number }): {
  allowed: boolean; remaining: number; resetAt: number;
} {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { allowed: true, remaining: limit.requests - 1, resetAt: now + limit.windowMs };
  }
  entry.count++;
  const allowed = entry.count <= limit.requests;
  if (!allowed) metrics.increment('rate_limit_exceeded_total', { tier: key.split(':')[1] });
  return { allowed, remaining: Math.max(0, limit.requests - entry.count), resetAt: entry.resetAt };
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tier: Tier = (req as any).user?.tier === 'pro' ? 'pro'
    : (req as any).user ? 'free'
    : 'anonymous';
  const limit = LIMITS[tier];
  const key = getKey(req, tier);
  const { allowed, remaining, resetAt } = checkLimit(key, limit);

  res.setHeader('X-RateLimit-Limit', limit.requests);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

  if (!allowed) {
    logger.warn({ key, tier }, 'Rate limit exceeded');
    res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil((resetAt - Date.now()) / 1000) });
    return;
  }
  next();
}

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);
