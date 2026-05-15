import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { createLogger } from '../lib/logger.js';
import { z } from 'zod';

const logger = createLogger('routes:locations');
export const locationsRouter = Router();

const LocationSchema = z.object({
  name: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  country: z.string().max(2).optional(),
  is_default: z.boolean().optional().default(false),
});

const FREE_TIER_LIMIT = 1;

// GET /api/locations — list all saved locations for user
locationsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  if (!supabaseAdmin) { res.status(503).json({ error: 'Database not configured' }); return; }
  const { data, error } = await supabaseAdmin
    .from('saved_locations')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('display_order');
  if (error) { logger.error({ error }, 'Failed to fetch locations'); res.status(500).json({ error: 'Failed to fetch locations' }); return; }
  res.json(data);
});

// POST /api/locations — create new saved location
locationsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  if (!supabaseAdmin) { res.status(503).json({ error: 'Database not configured' }); return; }
  const parsed = LocationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid location data', details: parsed.error.errors }); return; }

  // Enforce free tier limit
  if (req.user!.tier === 'free') {
    const { count } = await supabaseAdmin.from('saved_locations').select('*', { count: 'exact', head: true }).eq('user_id', req.user!.id);
    if ((count ?? 0) >= FREE_TIER_LIMIT) {
      res.status(402).json({ error: 'Free tier limit reached', message: 'Upgrade to Pro for unlimited saved locations', upgradeUrl: '/upgrade' });
      return;
    }
  }

  const { data, error } = await supabaseAdmin.from('saved_locations').insert({ ...parsed.data, user_id: req.user!.id }).select().single();
  if (error) { logger.error({ error }, 'Failed to create location'); res.status(500).json({ error: 'Failed to save location' }); return; }
  logger.info({ userId: req.user!.id, locationId: data.id }, 'Location saved');
  res.status(201).json(data);
});

// DELETE /api/locations/:id
locationsRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  if (!supabaseAdmin) { res.status(503).json({ error: 'Database not configured' }); return; }
  const { error } = await supabaseAdmin.from('saved_locations').delete().eq('id', req.params.id).eq('user_id', req.user!.id);
  if (error) { logger.error({ error }, 'Failed to delete location'); res.status(500).json({ error: 'Failed to delete location' }); return; }
  res.status(204).send();
});

// PATCH /api/locations/:id — update (name, is_default, display_order)
locationsRouter.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  if (!supabaseAdmin) { res.status(503).json({ error: 'Database not configured' }); return; }
  const UpdateSchema = LocationSchema.partial();
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid data' }); return; }
  const { data, error } = await supabaseAdmin.from('saved_locations').update(parsed.data).eq('id', req.params.id).eq('user_id', req.user!.id).select().single();
  if (error) { res.status(500).json({ error: 'Failed to update location' }); return; }
  res.json(data);
});
