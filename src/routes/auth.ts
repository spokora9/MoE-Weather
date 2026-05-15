import { Router, type Request, type Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('routes:auth');
export const authRouter = Router();

// Get current user info
authRouter.get('/me', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({ id: req.user.id, email: req.user.email, tier: req.user.tier });
});

// Sign out (client-side token invalidation)
authRouter.post('/signout', (req: Request, res: Response) => {
  logger.info({ userId: req.user?.id }, 'User signed out');
  res.json({ message: 'Signed out successfully' });
});
