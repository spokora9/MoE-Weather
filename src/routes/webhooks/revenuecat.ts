import { Router, type Request, type Response } from 'express';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('webhook:revenuecat');

export const revenuecatRouter = Router();

interface RevenueCatEvent {
  event: {
    type: string;
    app_user_id: string;
    product_id?: string;
    expiration_at_ms?: number;
  };
}

function verifySecret(req: Request): boolean {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification in dev
  return req.headers['authorization'] === `Bearer ${secret}`;
}

revenuecatRouter.post('/', async (req: Request, res: Response) => {
  if (!verifySecret(req)) {
    logger.warn('RevenueCat webhook auth failed');
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const body = req.body as RevenueCatEvent;
  const { type, app_user_id, expiration_at_ms } = body.event;

  logger.info({ type, app_user_id }, 'RevenueCat webhook received');

  try {
    // Dynamic import to avoid crashing when Supabase isn't configured
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.warn('Supabase not configured — skipping subscription sync');
      res.json({ received: true });
      return;
    }

    const admin = createClient(supabaseUrl, supabaseKey);

    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE': {
        await admin.from('subscriptions').upsert({
          user_id: app_user_id,
          tier: 'pro',
          status: 'active',
          expires_at: expiration_at_ms ? new Date(expiration_at_ms).toISOString() : null,
          updated_at: new Date().toISOString(),
        });
        logger.info({ app_user_id, type }, 'Subscription activated');
        break;
      }
      case 'CANCELLATION':
      case 'EXPIRATION': {
        await admin.from('subscriptions').upsert({
          user_id: app_user_id,
          tier: 'free',
          status: 'cancelled',
          expires_at: null,
          updated_at: new Date().toISOString(),
        });
        logger.info({ app_user_id, type }, 'Subscription cancelled');
        break;
      }
      default:
        logger.debug({ type }, 'Unhandled RevenueCat event type');
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, 'RevenueCat webhook handler error');
    res.status(500).json({ error: 'internal_error' });
  }
});
