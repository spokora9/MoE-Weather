/**
 * Push notification routes.
 *
 * Endpoints:
 *   POST   /subscribe         (auth) — store a Web Push subscription
 *   DELETE /unsubscribe       (auth) — remove a subscription by endpoint
 *   POST   /test              (auth) — send a test push to all of user's subs
 *   GET    /vapid-public-key  (no auth) — frontend needs this to call subscribe()
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { createLogger } from '../lib/logger.js';
import {
  getPublicVapidKey,
  sendPushNotification,
  type PushSubscriptionPayload,
} from '../lib/push.js';

const logger = createLogger('routes:notifications');
export const notificationsRouter = Router();

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const UnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// GET /vapid-public-key — public; no auth required
notificationsRouter.get('/vapid-public-key', (_req: Request, res: Response) => {
  const key = getPublicVapidKey();
  if (!key) {
    res.status(503).json({ error: 'Push notifications not configured' });
    return;
  }
  res.json({ publicKey: key });
});

// POST /subscribe
notificationsRouter.post('/subscribe', requireAuth, async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }
  const parsed = SubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid subscription', details: parsed.error.errors });
    return;
  }

  const row = {
    user_id: req.user!.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
  };

  // Upsert on endpoint so a re-subscribe from the same browser overwrites cleanly.
  const { data, error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Failed to save push subscription');
    res.status(500).json({ error: 'Failed to save subscription' });
    return;
  }

  logger.info({ userId: req.user!.id, subscriptionId: data?.id }, 'Push subscription saved');
  res.status(201).json(data);
});

// DELETE /unsubscribe
notificationsRouter.delete('/unsubscribe', requireAuth, async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }
  const parsed = UnsubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', req.user!.id)
    .eq('endpoint', parsed.data.endpoint);

  if (error) {
    logger.error({ err: error }, 'Failed to delete push subscription');
    res.status(500).json({ error: 'Failed to unsubscribe' });
    return;
  }

  res.status(204).send();
});

// POST /test — send a test notification to all of the user's subscriptions
notificationsRouter.post('/test', requireAuth, async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }

  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', req.user!.id);

  if (error) {
    logger.error({ err: error }, 'Failed to load subscriptions for test');
    res.status(500).json({ error: 'Failed to load subscriptions' });
    return;
  }

  const rows = (subs ?? []) as Array<{ endpoint: string; p256dh: string; auth: string }>;
  if (rows.length === 0) {
    res.status(404).json({ error: 'No active subscriptions' });
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const subscription: PushSubscriptionPayload = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    const ok = await sendPushNotification(subscription, {
      title: 'MoE Weather',
      body: 'Test notification — your push subscription is working!',
      tag: 'test',
    });
    ok ? sent++ : failed++;
  }

  res.json({ sent, failed, total: rows.length });
});
