import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';

import { createGeocodeRouter, parseAcceptLanguage } from '../geocode.js';

// ---------------------------------------------------------------------------
// Test server helpers
// ---------------------------------------------------------------------------
function buildTestServer(geocodeFn: (q: string, lang?: string) => Promise<unknown>) {
  const app = express();
  app.use(express.json());
  app.use('/', createGeocodeRouter({ geocode: geocodeFn } as never));
  const server = createServer(app);
  return new Promise<{ server: Server; baseUrl: string }>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()));
  });
}

async function get(
  baseUrl: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
  let body: unknown = null;
  if ((res.headers.get('content-type') ?? '').includes('application/json')) {
    body = await res.json();
  }
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// parseAcceptLanguage unit tests
// ---------------------------------------------------------------------------
describe('parseAcceptLanguage', () => {
  it('returns null for undefined / empty headers', () => {
    expect(parseAcceptLanguage(undefined)).toBeNull();
    expect(parseAcceptLanguage('')).toBeNull();
  });

  it('extracts the first language tag from a weighted header', () => {
    expect(parseAcceptLanguage('de-DE,de;q=0.9,en;q=0.8')).toBe('de-DE');
  });

  it('handles a single language tag', () => {
    expect(parseAcceptLanguage('fr')).toBe('fr');
  });

  it('normalizes casing (language lower, region upper)', () => {
    expect(parseAcceptLanguage('EN-us')).toBe('en-US');
  });

  it('returns null for malformed tags', () => {
    expect(parseAcceptLanguage('english')).toBeNull();
    expect(parseAcceptLanguage('123')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Route integration tests
// ---------------------------------------------------------------------------
describe('GET /api/geocode — language passthrough', () => {
  let server: Server;
  let baseUrl: string;
  // Use a permissive mock signature so .mockResolvedValueOnce returning richer
  // shapes doesn't fight TypeScript's inferred return type.
  let geocodeMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    geocodeMock = vi.fn();
    geocodeMock.mockResolvedValue([
      { name: 'mock', country: 'XX', latitude: 0, longitude: 0 },
    ]);
    ({ server, baseUrl } = await buildTestServer(geocodeMock as never));
  });

  afterEach(async () => {
    await closeServer(server);
  });

  it('forwards explicit lang=de to the orchestrator (German results)', async () => {
    geocodeMock.mockResolvedValueOnce([
      { name: 'Köln', country: 'DE', latitude: 50.9, longitude: 6.9 },
    ]);

    const { status, body } = await get(baseUrl, '/?q=Koln&lang=de');

    expect(status).toBe(200);
    expect(geocodeMock).toHaveBeenCalledWith('Koln', 'de');
    expect((body as Array<{ name: string }>)[0]?.name).toBe('Köln');
  });

  it('falls back to Accept-Language header when no lang query param is given', async () => {
    const { status } = await get(baseUrl, '/?q=Cologne', {
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    });

    expect(status).toBe(200);
    expect(geocodeMock).toHaveBeenCalledWith('Cologne', 'de-DE');
  });

  it('defaults to "en" when no lang param and no Accept-Language header', async () => {
    const { status } = await get(baseUrl, '/?q=Cologne');

    expect(status).toBe(200);
    expect(geocodeMock).toHaveBeenCalledWith('Cologne', 'en');
  });

  it('prefers query param lang over Accept-Language header', async () => {
    const { status } = await get(baseUrl, '/?q=Cologne&lang=fr', {
      'Accept-Language': 'de-DE',
    });

    expect(status).toBe(200);
    expect(geocodeMock).toHaveBeenCalledWith('Cologne', 'fr');
  });

  it('returns 400 for an invalid lang code', async () => {
    const { status, body } = await get(baseUrl, '/?q=Cologne&lang=english');

    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe('Invalid request parameters');
    expect(geocodeMock).not.toHaveBeenCalled();
  });

  it('returns 400 when q is missing', async () => {
    const { status } = await get(baseUrl, '/?lang=de');

    expect(status).toBe(400);
    expect(geocodeMock).not.toHaveBeenCalled();
  });

  it('ignores malformed Accept-Language and falls back to en', async () => {
    const { status } = await get(baseUrl, '/?q=Cologne', {
      'Accept-Language': 'not-a-language',
    });

    expect(status).toBe(200);
    expect(geocodeMock).toHaveBeenCalledWith('Cologne', 'en');
  });

  it('accepts all Open-Meteo supported languages', async () => {
    const supported = ['en', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'zh'];
    for (const lang of supported) {
      const { status } = await get(baseUrl, `/?q=Tokyo&lang=${lang}`);
      expect(status).toBe(200);
      expect(geocodeMock).toHaveBeenCalledWith('Tokyo', lang);
    }
  });
});
