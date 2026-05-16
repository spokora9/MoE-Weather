import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer, type Server } from 'node:http';

// ---------------------------------------------------------------------------
// Mock supabaseAdmin BEFORE importing the router
// ---------------------------------------------------------------------------
const mockFrom = vi.fn();

vi.mock('../../lib/supabase.js', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
  supabase: null,
  isSupabaseConfigured: () => false,
}));

// ---------------------------------------------------------------------------
// Mock auth middleware — we control req.user per test via currentUser
// ---------------------------------------------------------------------------
let currentUser: { id: string; email: string; tier: 'free' | 'pro' } | null = null;

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    if (!currentUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    req.user = currentUser;
    next();
  },
  optionalAuth: (req: Request, _res: Response, next: NextFunction) => {
    if (currentUser) req.user = currentUser;
    next();
  },
}));

// ---------------------------------------------------------------------------
// Now import the router (after mocks are set up)
// ---------------------------------------------------------------------------
import { locationsRouter } from '../locations.js';

// ---------------------------------------------------------------------------
// Test server helpers
// ---------------------------------------------------------------------------
function buildTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/', locationsRouter);
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

async function request(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let responseBody: unknown = null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    responseBody = await res.json();
  }
  return { status: res.status, body: responseBody };
}

// ---------------------------------------------------------------------------
// Helper: build a chainable mock for supabaseAdmin.from(...)
// Each call to .from() returns an object whose methods each return the same
// object, so chains like .select().eq().order() work.
// The terminal value is set per-test via the `resolves` field.
// ---------------------------------------------------------------------------
function makeChain(terminalValue: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single', 'head'];
  for (const m of methods) {
    chain[m] = vi.fn(() => {
      // Most methods return the chain to allow further chaining.
      // The last awaited call resolves with terminalValue.
      return Object.assign(Promise.resolve(terminalValue), chain);
    });
  }
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET / — returns 401 without auth', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    currentUser = null;
    ({ server, baseUrl } = await buildTestServer());
  });

  it('returns 401 when no user is authenticated', async () => {
    const { status, body } = await request(baseUrl, 'GET', '/');
    await closeServer(server);
    expect(status).toBe(401);
    expect((body as { error: string }).error).toBe('Authentication required');
  });
});

describe('POST / — free user at limit returns 402', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    currentUser = { id: 'free-user-1', email: 'free@example.com', tier: 'free' };

    // First call: select count → returns count = 1 (already at limit)
    // Second call (insert) should not be reached
    const countChain = makeChain({ count: 1, data: null, error: null });
    mockFrom.mockReturnValue(countChain);

    ({ server, baseUrl } = await buildTestServer());
  });

  it('returns 402 when free user already has 1 saved location', async () => {
    const { status, body } = await request(baseUrl, 'POST', '/', {
      name: 'Home',
      latitude: 40.7128,
      longitude: -74.006,
    });
    await closeServer(server);
    expect(status).toBe(402);
    expect((body as { error: string }).error).toBe('Free tier limit reached');
  });
});

describe('POST / — pro user with 5 existing locations succeeds', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    currentUser = { id: 'pro-user-1', email: 'pro@example.com', tier: 'pro' };

    // Pro users skip the count check; mock insert → returns a location record
    const fakeLocation = {
      id: 'loc-123',
      user_id: 'pro-user-1',
      name: 'Office',
      latitude: 51.5074,
      longitude: -0.1278,
      country: 'GB',
      is_default: false,
    };
    const insertChain = makeChain({ data: fakeLocation, error: null });
    mockFrom.mockReturnValue(insertChain);

    ({ server, baseUrl } = await buildTestServer());
  });

  it('returns 201 when pro user saves a location (regardless of existing count)', async () => {
    const { status, body } = await request(baseUrl, 'POST', '/', {
      name: 'Office',
      latitude: 51.5074,
      longitude: -0.1278,
      country: 'GB',
    });
    await closeServer(server);
    expect(status).toBe(201);
    expect((body as { id: string }).id).toBe('loc-123');
  });
});

describe('DELETE /:id — returns 204', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    currentUser = { id: 'user-del', email: 'del@example.com', tier: 'free' };

    const deleteChain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(deleteChain);

    ({ server, baseUrl } = await buildTestServer());
  });

  it('returns 204 on successful deletion', async () => {
    const { status } = await request(baseUrl, 'DELETE', '/loc-abc');
    await closeServer(server);
    expect(status).toBe(204);
  });
});

describe('POST / — invalid body returns 400', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    currentUser = { id: 'user-val', email: 'val@example.com', tier: 'pro' };
    // mockFrom won't be called since validation fails first
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

    ({ server, baseUrl } = await buildTestServer());
  });

  it('returns 400 when latitude is 999 (out of range)', async () => {
    const { status, body } = await request(baseUrl, 'POST', '/', {
      name: 'Bad Location',
      latitude: 999,
      longitude: 0,
    });
    await closeServer(server);
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe('Invalid location data');
  });
});
