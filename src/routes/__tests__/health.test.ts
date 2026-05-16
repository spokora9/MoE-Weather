import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { mswServer } from '../../test/setup.js';
import { healthRouter } from '../health.js';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

// Helper: start Express on an ephemeral port and return { server, baseUrl }
function buildTestServer() {
  const app = express();
  app.use('/health', healthRouter);
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

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url);
  const body = await res.json();
  return { status: res.status, body };
}

describe('GET /health/live', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await buildTestServer());
  });

  afterAll(async () => {
    await closeServer(server);
  });

  it('always returns 200 with status ok', async () => {
    const { status, body } = await getJson(`${baseUrl}/health/live`);
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe('ok');
    expect(typeof (body as { timestamp: string }).timestamp).toBe('string');
  });

  it('does not depend on external services', async () => {
    // Even with Open-Meteo mocked as failing, /live should return 200
    mswServer.use(
      http.get(OPEN_METEO_URL, () => HttpResponse.error())
    );
    const { status } = await getJson(`${baseUrl}/health/live`);
    expect(status).toBe(200);
  });
});

describe('GET /health/ready', () => {
  let server: Server;
  let baseUrl: string;
  let savedRedisUrl: string | undefined;

  beforeAll(async () => {
    ({ server, baseUrl } = await buildTestServer());
  });

  afterAll(async () => {
    await closeServer(server);
  });

  beforeEach(() => {
    // Ensure Redis check is skipped (no REDIS_URL set)
    savedRedisUrl = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    if (savedRedisUrl !== undefined) {
      process.env.REDIS_URL = savedRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
  });

  it('returns 200 when Open-Meteo responds OK', async () => {
    mswServer.use(
      http.get(OPEN_METEO_URL, () =>
        HttpResponse.json({ current: { temperature_2m: 15 } }, { status: 200 })
      )
    );

    const { status, body } = await getJson(`${baseUrl}/health/ready`);
    const b = body as {
      status: string;
      checks: Record<string, { healthy: boolean }>;
      timestamp: string;
    };

    expect(status).toBe(200);
    expect(b.status).toBe('ready');
    expect(b.checks['open-meteo'].healthy).toBe(true);
    expect(typeof b.timestamp).toBe('string');
  });

  it('returns 503 when Open-Meteo responds with 500', async () => {
    mswServer.use(
      http.get(OPEN_METEO_URL, () =>
        HttpResponse.json({ error: 'internal error' }, { status: 500 })
      )
    );

    const { status, body } = await getJson(`${baseUrl}/health/ready`);
    const b = body as {
      status: string;
      checks: Record<string, { healthy: boolean }>;
    };

    expect(status).toBe(503);
    expect(b.status).toBe('degraded');
    expect(b.checks['open-meteo'].healthy).toBe(false);
  });

  it('returns 503 when Open-Meteo is unreachable (network error)', async () => {
    mswServer.use(
      http.get(OPEN_METEO_URL, () => HttpResponse.error())
    );

    const { status, body } = await getJson(`${baseUrl}/health/ready`);
    const b = body as {
      status: string;
      checks: Record<string, { healthy: boolean; error?: string }>;
    };

    expect(status).toBe(503);
    expect(b.status).toBe('degraded');
    expect(b.checks['open-meteo'].healthy).toBe(false);
    expect(b.checks['open-meteo'].error).toBe('timeout or network error');
  });
});
