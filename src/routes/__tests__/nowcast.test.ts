import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer, type Server } from 'node:http';

// ---------------------------------------------------------------------------
// Mock auth middleware BEFORE importing the router.
// `currentUser` is mutated per-test to simulate anonymous / free / pro
// callers without exercising real Supabase token verification.
// ---------------------------------------------------------------------------
let currentUser: { id: string; email: string; tier: 'free' | 'pro' } | null = null;

vi.mock('../../middleware/auth.js', () => ({
  optionalAuth: (req: Request, _res: Response, next: NextFunction) => {
    if (currentUser) req.user = currentUser;
    next();
  },
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    if (!currentUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    req.user = currentUser;
    next();
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are set up.
// ---------------------------------------------------------------------------
import { createNowcastRouter } from '../nowcast.js';
import { TomorrowIOAdapter, type NowcastEntry } from '../../adapters/tomorrow-io.js';
import type { WeatherOrchestrator } from '../../engine/orchestrator.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function buildFakeAdapter(opts: {
  hasQuota?: boolean;
  getNowcast?: (lat: number, lon: number) => Promise<NowcastEntry[]>;
}): TomorrowIOAdapter {
  const adapter = new TomorrowIOAdapter('fake-key-for-tests');
  vi.spyOn(adapter, 'hasQuota').mockImplementation(() => opts.hasQuota ?? true);
  if (opts.getNowcast) {
    vi.spyOn(adapter, 'getNowcast').mockImplementation(opts.getNowcast);
  }
  return adapter;
}

function buildTestServer(adapter: TomorrowIOAdapter) {
  const app = express();
  app.use(express.json());
  // The orchestrator is unused by the current router implementation, so we
  // pass a typed stub rather than spin up a real WeatherOrchestrator.
  const fakeOrchestrator = {} as WeatherOrchestrator;
  app.use('/', createNowcastRouter(fakeOrchestrator, adapter));
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
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, { method: 'GET' });
  let body: unknown = null;
  if ((res.headers.get('content-type') ?? '').includes('application/json')) {
    body = await res.json();
  }
  return { status: res.status, body };
}

function sampleNowcast(count = 60): NowcastEntry[] {
  const out: NowcastEntry[] = [];
  const base = Date.UTC(2026, 4, 16, 12, 0, 0);
  for (let i = 0; i < count; i++) {
    out.push({
      time: new Date(base + i * 60_000).toISOString(),
      precipitationIntensity: i < 10 ? 0.5 : 0,
      precipitationProbability: i < 10 ? 80 : 5,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
type NowcastFn = (lat: number, lon: number) => Promise<NowcastEntry[]>;

describe('GET /api/nowcast — tier gating', () => {
  let server: Server;
  let baseUrl: string;
  let getNowcastSpy: ReturnType<typeof vi.fn<Parameters<NowcastFn>, ReturnType<NowcastFn>>>;

  beforeEach(async () => {
    getNowcastSpy = vi.fn<Parameters<NowcastFn>, ReturnType<NowcastFn>>(async () => sampleNowcast());
    const adapter = buildFakeAdapter({ getNowcast: getNowcastSpy });
    ({ server, baseUrl } = await buildTestServer(adapter));
  });

  afterEach(async () => {
    await closeServer(server);
    currentUser = null;
    vi.restoreAllMocks();
  });

  it('returns 402 for anonymous callers with upgradeUrl in body', async () => {
    currentUser = null;
    const { status, body } = await get(baseUrl, '/?lat=40.7&lon=-74.0');
    expect(status).toBe(402);
    expect((body as { error: string }).error).toBe('upgrade_required');
    expect((body as { upgradeUrl: string }).upgradeUrl).toBe('/api/subscription/upgrade');
    expect(getNowcastSpy).not.toHaveBeenCalled();
  });

  it('returns 402 for free-tier users with upgradeUrl in body', async () => {
    currentUser = { id: 'free-1', email: 'free@example.com', tier: 'free' };
    const { status, body } = await get(baseUrl, '/?lat=40.7&lon=-74.0');
    expect(status).toBe(402);
    expect((body as { error: string }).error).toBe('upgrade_required');
    expect((body as { upgradeUrl: string }).upgradeUrl).toBe('/api/subscription/upgrade');
    expect(getNowcastSpy).not.toHaveBeenCalled();
  });

  it('returns 200 with a nowcast array for pro-tier users', async () => {
    currentUser = { id: 'pro-1', email: 'pro@example.com', tier: 'pro' };
    const { status, body } = await get(baseUrl, '/?lat=40.7&lon=-74.0');
    expect(status).toBe(200);
    const payload = body as {
      location: { lat: number; lon: number };
      nowcast: NowcastEntry[];
      unit: string;
      fetchedAt: string;
    };
    expect(payload.location).toEqual({ lat: 40.7, lon: -74.0 });
    expect(payload.unit).toBe('mm/h');
    expect(payload.nowcast).toHaveLength(60);
    expect(payload.nowcast[0]).toHaveProperty('time');
    expect(payload.nowcast[0]).toHaveProperty('precipitationIntensity');
    expect(payload.nowcast[0]).toHaveProperty('precipitationProbability');
    expect(typeof payload.fetchedAt).toBe('string');
    expect(getNowcastSpy).toHaveBeenCalledOnce();
    expect(getNowcastSpy).toHaveBeenCalledWith(40.7, -74.0);
  });
});

describe('GET /api/nowcast — input validation', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    currentUser = { id: 'pro-2', email: 'pro@example.com', tier: 'pro' };
    const adapter = buildFakeAdapter({ getNowcast: async () => sampleNowcast() });
    ({ server, baseUrl } = await buildTestServer(adapter));
  });

  afterEach(async () => {
    await closeServer(server);
    currentUser = null;
    vi.restoreAllMocks();
  });

  it('returns 400 for missing coordinates', async () => {
    const { status, body } = await get(baseUrl, '/');
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe('Invalid request parameters');
  });

  it('returns 400 for out-of-range latitude', async () => {
    const { status, body } = await get(baseUrl, '/?lat=999&lon=0');
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe('Invalid request parameters');
  });

  it('returns 400 for non-numeric longitude', async () => {
    const { status } = await get(baseUrl, '/?lat=10&lon=not-a-number');
    expect(status).toBe(400);
  });
});

describe('GET /api/nowcast — upstream failure handling', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(() => {
    currentUser = { id: 'pro-3', email: 'pro@example.com', tier: 'pro' };
  });

  afterEach(async () => {
    if (server) await closeServer(server);
    currentUser = null;
    vi.restoreAllMocks();
  });

  it('returns 503 when Tomorrow.io is not configured (no quota / no key)', async () => {
    const adapter = buildFakeAdapter({ hasQuota: false });
    ({ server, baseUrl } = await buildTestServer(adapter));

    const { status, body } = await get(baseUrl, '/?lat=40.7&lon=-74.0');
    expect(status).toBe(503);
    expect((body as { error: string }).error).toBe('service_unavailable');
  });

  it('returns 503 when adapter.getNowcast() throws', async () => {
    const adapter = buildFakeAdapter({
      getNowcast: async () => {
        throw new Error('upstream timeout');
      },
    });
    ({ server, baseUrl } = await buildTestServer(adapter));

    const { status, body } = await get(baseUrl, '/?lat=40.7&lon=-74.0');
    expect(status).toBe(503);
    expect((body as { error: string }).error).toBe('service_unavailable');
  });

  it('returns 503 when adapter returns an empty array (upstream effectively down)', async () => {
    const adapter = buildFakeAdapter({ getNowcast: async () => [] });
    ({ server, baseUrl } = await buildTestServer(adapter));

    const { status, body } = await get(baseUrl, '/?lat=40.7&lon=-74.0');
    expect(status).toBe(503);
    expect((body as { error: string }).error).toBe('service_unavailable');
  });
});

describe('GET /api/nowcast — caching', () => {
  let server: Server;
  let baseUrl: string;
  let getNowcastSpy: ReturnType<typeof vi.fn<Parameters<NowcastFn>, ReturnType<NowcastFn>>>;

  beforeEach(async () => {
    currentUser = { id: 'pro-cache', email: 'pro@example.com', tier: 'pro' };
    getNowcastSpy = vi.fn<Parameters<NowcastFn>, ReturnType<NowcastFn>>(async () => sampleNowcast());
    const adapter = buildFakeAdapter({ getNowcast: getNowcastSpy });
    ({ server, baseUrl } = await buildTestServer(adapter));
  });

  afterEach(async () => {
    await closeServer(server);
    currentUser = null;
    vi.restoreAllMocks();
  });

  it('serves the second call within 5 minutes from cache (only one upstream call)', async () => {
    const first = await get(baseUrl, '/?lat=40.7&lon=-74.0');
    const second = await get(baseUrl, '/?lat=40.7&lon=-74.0');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(getNowcastSpy).toHaveBeenCalledTimes(1);

    // Cached payload should be byte-identical (including fetchedAt).
    expect((second.body as { fetchedAt: string }).fetchedAt).toBe(
      (first.body as { fetchedAt: string }).fetchedAt
    );
  });

  it('issues a separate upstream call for a different coordinate', async () => {
    await get(baseUrl, '/?lat=40.7&lon=-74.0');
    await get(baseUrl, '/?lat=51.5&lon=-0.13');
    expect(getNowcastSpy).toHaveBeenCalledTimes(2);
  });

  it('treats coordinates that round to the same 2-decimal grid as a cache hit', async () => {
    await get(baseUrl, '/?lat=40.7&lon=-74.0');
    await get(baseUrl, '/?lat=40.701&lon=-74.001');
    expect(getNowcastSpy).toHaveBeenCalledTimes(1);
  });
});
