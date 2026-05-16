/**
 * MeteoAlarm Adapter — Official EU Severe Weather Alerts
 * Covers 35+ European countries via the MeteoAlarm Atom feed.
 * https://www.meteoalarm.org/
 *
 * No API key required. Feed URL pattern:
 *   https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-{countryCode}
 */

import {
  WeatherAdapter,
  type AdapterConfig,
  type AdapterResponse,
} from './base.js';
import type { WeatherRequest, WeatherAlert } from '../types/weather.js';
import { getCountryCode, isEULocation } from '../lib/country-lookup.js';

// ---------------------------------------------------------------------------
// Cache entry type
// ---------------------------------------------------------------------------
interface CacheEntry {
  alerts: WeatherAlert[];
  fetchedAt: number; // epoch ms
}

// Cache TTL: 60 seconds
const CACHE_TTL_MS = 60_000;

// ---------------------------------------------------------------------------
// MeteoAlarm severity mapping (CAP severity element values)
// ---------------------------------------------------------------------------
const SEVERITY_MAP: Record<string, WeatherAlert['severity']> = {
  Extreme: 'extreme',
  Severe: 'severe',
  Moderate: 'moderate',
  Minor: 'minor',
};

// ---------------------------------------------------------------------------
// Minimal XML helpers (regex-based; no extra dependency)
// ---------------------------------------------------------------------------

/** Extract the text content of the first occurrence of <tagName>…</tagName>. */
function extractTag(xml: string, tagName: string): string {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = re.exec(xml);
  return match ? match[1].trim() : '';
}

/** Extract all text contents of every <tagName>…</tagName> occurrence. */
function extractAllTags(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

/** Strip CDATA wrappers and HTML/XML tags from a string. */
function cleanText(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

// ---------------------------------------------------------------------------
// MeteoAlarmAdapter
// ---------------------------------------------------------------------------

export class MeteoAlarmAdapter extends WeatherAdapter {
  /** In-memory cache: countryCode → CacheEntry */
  private cache = new Map<string, CacheEntry>();

  constructor(config?: Partial<AdapterConfig>) {
    super('meteo-alarm', {
      baseUrl: 'https://feeds.meteoalarm.org/feeds',
      timeout: 10_000,
      retries: 2,
      ...config,
    });

    // Unlimited quota — public feed, no rate limiting documented
    this.quota = {
      limit: Infinity,
      used: 0,
      resetAt: new Date(),
      type: 'unlimited',
    };
  }

  // -------------------------------------------------------------------------
  // Coverage check
  // -------------------------------------------------------------------------

  isInCoverageArea(lat: number, lon: number): boolean {
    return isEULocation(lat, lon);
  }

  // -------------------------------------------------------------------------
  // Main fetch
  // -------------------------------------------------------------------------

  async fetch(request: WeatherRequest): Promise<AdapterResponse> {
    const startTime = Date.now();
    const { latitude: lat, longitude: lon } = request;

    // Resolve country code
    const countryCode = getCountryCode(lat, lon);
    if (!countryCode) {
      return {
        alerts: [],
        raw: {
          provider: 'meteo-alarm',
          data: { error: 'Location outside MeteoAlarm coverage area' },
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        },
      };
    }

    // Serve from cache if fresh
    const cached = this.cache.get(countryCode);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return {
        alerts: cached.alerts,
        raw: {
          provider: 'meteo-alarm',
          data: { source: 'cache', countryCode },
          fetchedAt: new Date(cached.fetchedAt),
          responseTime: Date.now() - startTime,
        },
      };
    }

    // Fetch the Atom feed
    const feedUrl = `${this.config.baseUrl}/meteoalarm-legacy-atom-${countryCode.toLowerCase()}`;
    try {
      const response = await this.fetchFeed(feedUrl);
      const xml = await response.text();
      const alerts = this.parseAtomFeed(xml);

      // Update cache
      this.cache.set(countryCode, { alerts, fetchedAt: Date.now() });
      this.incrementQuota();

      return {
        alerts,
        raw: {
          provider: 'meteo-alarm',
          data: { countryCode, alertCount: alerts.length },
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      // On network/parse failure return empty alerts (not an error response),
      // so the consensus layer keeps working.
      return {
        alerts: [],
        raw: {
          provider: 'meteo-alarm',
          data: { error: (error as Error).message, countryCode },
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  // -------------------------------------------------------------------------
  // HTTP helper (with timeout + retries)
  // -------------------------------------------------------------------------

  private async fetchFeed(url: string): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout
      );
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res;
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err as Error;
        if (attempt < this.config.retries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 500)
          );
        }
      }
    }

    throw lastError ?? new Error('Failed to fetch MeteoAlarm feed');
  }

  // -------------------------------------------------------------------------
  // Atom feed parser
  // -------------------------------------------------------------------------

  private parseAtomFeed(xml: string): WeatherAlert[] {
    // Split on <entry> elements
    const entryPattern = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    const alerts: WeatherAlert[] = [];
    let match: RegExpExecArray | null;

    while ((match = entryPattern.exec(xml)) !== null) {
      const entry = match[1];

      try {
        const alert = this.parseEntry(entry);
        if (alert) alerts.push(alert);
      } catch {
        // Skip malformed entries
      }
    }

    return alerts;
  }

  private parseEntry(entry: string): WeatherAlert | null {
    // id
    const id = cleanText(extractTag(entry, 'id'));

    // title — used as headline
    const headline = cleanText(extractTag(entry, 'title'));

    // summary / content — used as description
    const description =
      cleanText(extractTag(entry, 'summary')) ||
      cleanText(extractTag(entry, 'content')) ||
      headline;

    // event type: look for cap:event or the first <category> label
    const capEvent = cleanText(extractTag(entry, 'cap:event'));
    const categoryTerm =
      this.extractAttrFromTag(entry, 'category', 'term') ?? '';
    const event = capEvent || categoryTerm || 'Weather Alert';

    // Severity: cap:severity
    const capSeverity = cleanText(extractTag(entry, 'cap:severity'));
    const severity: WeatherAlert['severity'] =
      SEVERITY_MAP[capSeverity] ?? 'moderate';

    // Urgency: cap:urgency
    const capUrgency = cleanText(extractTag(entry, 'cap:urgency'));
    const urgency = this.mapUrgency(capUrgency);

    // Onset / effective → start
    const onset = cleanText(extractTag(entry, 'cap:onset'));
    const effective = cleanText(extractTag(entry, 'cap:effective'));
    const updated = cleanText(extractTag(entry, 'updated'));
    const published = cleanText(extractTag(entry, 'published'));
    const start = new Date(onset || effective || updated || published || Date.now());

    // Expires → end
    const expires = cleanText(extractTag(entry, 'cap:expires'));
    const end = expires ? new Date(expires) : new Date(start.getTime() + 3600_000);

    // Skip entries without a usable id
    if (!id && !headline) return null;

    return {
      id: id || headline,
      event,
      headline,
      description,
      severity,
      urgency,
      start,
      end,
      source: 'MeteoAlarm',
    };
  }

  /** Extract an XML attribute value from the first matching self-closing or open tag. */
  private extractAttrFromTag(
    xml: string,
    tagName: string,
    attrName: string
  ): string | null {
    const re = new RegExp(
      `<${tagName}[^>]*\\s${attrName}="([^"]*)"`,
      'i'
    );
    const m = re.exec(xml);
    return m ? m[1] : null;
  }

  private mapUrgency(raw: string): WeatherAlert['urgency'] {
    const map: Record<string, WeatherAlert['urgency']> = {
      Immediate: 'immediate',
      Expected: 'expected',
      Future: 'future',
      Past: 'past',
      Unknown: 'unknown',
    };
    return map[raw] ?? 'unknown';
  }

  // -------------------------------------------------------------------------
  // Health check — try the German feed (reliable, central Europe)
  // -------------------------------------------------------------------------

  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.fetchFeed(
        `${this.config.baseUrl}/meteoalarm-legacy-atom-de`
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Weights — alerts only; this adapter contributes nothing to weather fields
  // -------------------------------------------------------------------------

  getBaseWeight(): number {
    return 0.10; // Alerts only — low weight on weather metrics
  }

  getConditionWeights(): Record<string, number> {
    return {
      temperature: 0.0,
      precipitation: 0.0,
      wind: 0.0,
      humidity: 0.0,
      uvIndex: 0.0,
      alerts: 0.9, // High authority for EU official alerts
    };
  }
}
