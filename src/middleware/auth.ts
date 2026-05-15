import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('middleware:auth');

export interface AuthUser {
  id: string;
  email: string;
  tier: 'free' | 'pro';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Optional auth — attaches req.user if valid JWT present, else continues
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || !supabase) {
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      // Tier comes from user_metadata (set by subscription webhook)
      const tier = (user.user_metadata?.tier as 'free' | 'pro') || 'free';
      req.user = { id: user.id, email: user.email ?? '', tier };
      logger.debug({ userId: user.id, tier }, 'User authenticated');
    }
  } catch (err) {
    logger.warn({ err }, 'Auth token validation failed');
  }
  next();
}

// Required auth — returns 401 if no valid JWT
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  await optionalAuth(req, res, async () => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    next();
  });
}
