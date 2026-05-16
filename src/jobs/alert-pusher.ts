/**
 * Alert pusher background job.
 *
 * Every N minutes:
 *   1. Collect distinct (lat, lon) pairs from `saved_locations`.
 *   2. For each location, fetch weather and inspect `alerts`.
 *   3. For every alert with severity >= "moderate", find users who saved a
 *      location near that alert and push to all of their subscriptions.
 *   4. Dedupe via Redis: each (user_id, alert_id) is held for 24h after delivery
 *      so the same alert isn't re-pushed on subsequent ticks.
 *
 * Notes:
 *   - If Supabase is not configured, the job no-ops on each tick.
 *   - If Redis is not configured, dedupe is skipped (still functional, may
 *     duplicate within the 5-minute window — acceptable for dev/local).
 *   - If Web Push (VAPID) is not configured, sends are skipped silently.
 */

import { createLogger } from '../lib/logger.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { getRedisClient } from '../lib/redis.js';
import { sendPushNotification, type PushSubscriptionPayload } from '../lib/push.js';
import type { WeatherAlert, WeatherData } from '../types/weather.js';

const logger = createLogger('alert-pusher');

export type AlertSeverity = WeatherAlert['severity'];

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  minor: 1,
  moderate: 2,
  severe: 3,
  extreme: 4,
};

export const DEFAULT_MIN_SEVERITY: AlertSeverity = 'moderate';

type GetWeatherFn = (req: { latitude: number; longitude: number }) => Promise<WeatherData>;

interface SavedLocationRow {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface PushSubRow {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface AlertPusherOptions {
  intervalMs?: number;
  minSeverity?: AlertSeverity;
  dedupeTtlSeconds?: number;
}

export class AlertPusher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private readonly minSeverity: AlertSeverity;
  private readonly dedupeTtlSeconds: number;
  private readonly getWeather: GetWeatherFn;

  constructor(getWeather: GetWeatherFn, opts: AlertPusherOptions = {}) {
    this.getWeather = getWeather;
    this.intervalMs = opts.intervalMs ?? 5 * 60 * 1000;
    this.minSeverity = opts.minSeverity ?? DEFAULT_MIN_SEVERITY;
    this.dedupeTtlSeconds = opts.dedupeTtlSeconds ?? 24 * 60 * 60;
  }

  start(): void {
    logger.info(
      { intervalMs: this.intervalMs, minSeverity: this.minSeverity },
      'Alert pusher starting',
    );
    // Don't block startup; first tick runs on the interval.
    this.timer = setInterval(() => {
      this.tick().catch((err) => logger.error({ err }, 'Alert pusher tick failed'));
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Alert pusher stopped');
    }
  }

  /**
   * Public for tests — run a single sweep.
   * Returns counts so tests can assert behavior.
   */
  async tick(): Promise<{ alertsProcessed: number; pushesSent: number; deduped: number }> {
    if (!supabaseAdmin) {
      logger.debug('Skipping tick — Supabase not configured');
      return { alertsProcessed: 0, pushesSent: 0, deduped: 0 };
    }

    const { data: locations, error: locErr } = await supabaseAdmin
      .from('saved_locations')
      .select('id, user_id, name, latitude, longitude');

    if (locErr) {
      logger.error({ err: locErr }, 'Failed to load saved_locations');
      return { alertsProcessed: 0, pushesSent: 0, deduped: 0 };
    }

    const rows = (locations ?? []) as SavedLocationRow[];
    if (rows.length === 0) {
      return { alertsProcessed: 0, pushesSent: 0, deduped: 0 };
    }

    // Group locations by rounded coordinate to share weather fetches across users.
    const byCoord = new Map<string, { latitude: number; longitude: number; rows: SavedLocationRow[] }>();
    for (const r of rows) {
      const key = `${r.latitude.toFixed(2)},${r.longitude.toFixed(2)}`;
      const bucket = byCoord.get(key);
      if (bucket) bucket.rows.push(r);
      else byCoord.set(key, { latitude: r.latitude, longitude: r.longitude, rows: [r] });
    }

    let alertsProcessed = 0;
    let pushesSent = 0;
    let deduped = 0;

    for (const bucket of byCoord.values()) {
      let weather: WeatherData;
      try {
        weather = await this.getWeather({
          latitude: bucket.latitude,
          longitude: bucket.longitude,
        });
      } catch (err) {
        logger.warn({ err, lat: bucket.latitude, lon: bucket.longitude }, 'Weather fetch failed');
        continue;
      }

      const alerts = (weather.alerts ?? []).filter((a) => this.meetsSeverity(a.severity));
      if (alerts.length === 0) continue;

      // Affected users at this coordinate.
      const userIds = Array.from(new Set(bucket.rows.map((r) => r.user_id)));

      for (const alert of alerts) {
        alertsProcessed++;
        for (const userId of userIds) {
          const wasDuplicate = await this.isDuplicate(userId, alert.id);
          if (wasDuplicate) {
            deduped++;
            continue;
          }
          const sent = await this.pushAlertToUser(userId, alert);
          pushesSent += sent;
          if (sent > 0) {
            await this.markSent(userId, alert.id);
          }
        }
      }
    }

    logger.info({ alertsProcessed, pushesSent, deduped }, 'Alert pusher tick complete');
    return { alertsProcessed, pushesSent, deduped };
  }

  private meetsSeverity(severity: AlertSeverity): boolean {
    return SEVERITY_RANK[severity] >= SEVERITY_RANK[this.minSeverity];
  }

  private async pushAlertToUser(userId: string, alert: WeatherAlert): Promise<number> {
    if (!supabaseAdmin) return 0;

    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error) {
      logger.warn({ err: error, userId }, 'Failed to load subscriptions');
      return 0;
    }

    const rows = (subs ?? []) as PushSubRow[];
    let count = 0;
    for (const row of rows) {
      const subscription: PushSubscriptionPayload = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      const ok = await sendPushNotification(subscription, {
        title: alert.headline || alert.event,
        body: alert.description,
        tag: `alert:${alert.id}`,
        data: {
          alertId: alert.id,
          severity: alert.severity,
          event: alert.event,
        },
      });
      if (ok) count++;
    }
    return count;
  }

  private dedupeKey(userId: string, alertId: string): string {
    return `alert-pusher:sent:${userId}:${alertId}`;
  }

  private async isDuplicate(userId: string, alertId: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis) return false;
    try {
      const exists = await redis.exists(this.dedupeKey(userId, alertId));
      return exists === 1;
    } catch (err) {
      logger.warn({ err }, 'Redis dedupe check failed — treating as not duplicate');
      return false;
    }
  }

  private async markSent(userId: string, alertId: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    try {
      await redis.set(this.dedupeKey(userId, alertId), '1', 'EX', this.dedupeTtlSeconds);
    } catch (err) {
      logger.warn({ err }, 'Redis dedupe mark failed');
    }
  }
}
