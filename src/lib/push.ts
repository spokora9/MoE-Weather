/**
 * Web Push (VAPID) helper.
 *
 * Wraps the `web-push` library to provide a tiny, graceful API:
 *   - `isPushConfigured()` reports whether VAPID env vars are set.
 *   - `sendPushNotification()` returns `false` (no-op) when not configured
 *     instead of throwing, so calling code can degrade gracefully.
 *   - `generateVAPIDKeys()` is exposed for one-time operator setup.
 *
 * Required env vars:
 *   - VAPID_PUBLIC_KEY
 *   - VAPID_PRIVATE_KEY
 *   - VAPID_SUBJECT  (mailto: or https: URL — required by RFC 8292)
 */

import webpush from 'web-push';
import { createLogger } from './logger.js';

const logger = createLogger('push');

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

let _configured: boolean | null = null;

/**
 * Returns true if VAPID is fully configured AND web-push has been initialized.
 * Result is memoized so repeated calls don't re-set details on every send.
 */
export function isPushConfigured(): boolean {
  if (_configured !== null) return _configured;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    logger.warn('VAPID keys not configured — push notifications disabled');
    _configured = false;
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    _configured = true;
    logger.info('Web Push initialized with VAPID');
    return true;
  } catch (err) {
    logger.error({ err }, 'Failed to initialize web-push');
    _configured = false;
    return false;
  }
}

/**
 * Exposed for tests — clears the memoized config flag so env-var changes
 * between test cases are picked up.
 */
export function _resetPushConfigForTests(): void {
  _configured = null;
}

/**
 * Returns the configured VAPID public key, or null if not configured.
 * The PWA frontend needs this to call `pushManager.subscribe`.
 */
export function getPublicVapidKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

/**
 * Send a single push notification.
 *
 * Returns `true` on successful delivery (HTTP 2xx from the push service),
 * `false` otherwise. Never throws — callers can iterate over many subscriptions
 * without worrying about a single failure aborting the batch.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionPayload,
  payload: NotificationPayload,
): Promise<boolean> {
  if (!isPushConfigured()) {
    logger.debug('Skipping push send — VAPID not configured');
    return false;
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
    );
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410 = subscription is gone (user unsubscribed / endpoint expired).
    // Caller may want to delete the row from the DB.
    if (status === 404 || status === 410) {
      logger.info({ endpoint: subscription.endpoint, status }, 'Push subscription expired');
    } else {
      logger.warn({ err, endpoint: subscription.endpoint }, 'Push send failed');
    }
    return false;
  }
}

/**
 * Generate a fresh VAPID keypair. Intended for one-time operator setup —
 * the output should be persisted into env vars (NOT regenerated per deploy,
 * which would invalidate every existing subscription).
 */
export function generateVAPIDKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys();
}
