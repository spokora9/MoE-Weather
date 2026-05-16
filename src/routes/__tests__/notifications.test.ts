import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer, type Server } from 'node:http';

// ---------------------------------------------------------------------------
// Mock supabaseAdmin (hoisted so vi.mock can reference it)
// ---------------------------------------------------------------------------
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('../../lib/supabase.js', () => ({
  supabaseAdmin: { from: mockFrom },
  supabase: null,
  isSupabaseConfigured: () => false,
}));

// ---------------------------------------------------------------------------
// Mock requireAuth — test-controlled user
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
// Mock push helpers — control return values per test
// ---------------------------------------------------------------------------
const { mockSendPush, mockGetPublicVapidKey } = vi.hoisted(() => ({
  mockSendPush: vi.fn(),
  mockGetPublicVapidKey: vi.fn(),
}));

vi.mock('../../lib/push.js', () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPush(...args),
  getPublicVapidKey: () => mockGetPublicVapidKey(),
  isPushConfigured: () => true,
}));

// ---------------------------------------------------------------------------
// Import router AFTER mocks
// ---------------------------------------------------------------------------
import { notificationsRouter } from '../notifications.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function buildTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/', notificationsRouter);
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
    server.close((err) => (err ? reject(err) : resolve()));
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
  if (ct.includes('application/json')) responseBody = await res.json();
  return { status: res.status, body: responseBody };
}

// Chainable supabase mock — terminal value drives the final awaited result.
function makeChain(terminalValue: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'order', 'single', 'head'];
  for (const m of methods) {
    chain[m] = vi.fn(() => Object.assign(Promise.resolve(terminalValue), chain));
  }
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /vapid-public-key', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(() => {
    currentUser = null;
    mockGetPublicVapidKey.mockReset();
    mockSendPush.mockReset();
    mockFrom.mockReset();
  });

  it('returns 503 when VAPID is not configured', async () => {
    mockGetPublicVapidKey.mockReturnValue(null);
    ({ server, baseUrl } = await buildTestServer());
    const { status, body } = await request(baseUrl, 'GET', '/vapid-public-key');
    await closeServer(server);
    expect(status).toBe(503);
    expect((body as { error: string }).error).toBe('Push notifications not configured');
  });

  it('returns the public key (no auth required)', async () => {
    mockGetPublicVapidKey.mockReturnValue('test-public-key');
    ({ server, baseUrl } = await buildTestServer());
    const { status, body } = await request(baseUrl, 'GET', '/vapid-public-key');
    await closeServer(server);
    expect(status).toBe(200);
    expect((body as { publicKey: string }).publicKey).toBe('test-public-key');
  });
});

describe('POST /subscribe', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(() => {
    currentUser = { id: 'user-1', email: 'u@example.com', tier: 'free' };
    mockFrom.mockReset();
  });

  it('returns 401 without auth', async () => {
    currentUser = null;
    ({ server, baseUrl } = await buildTestServer());
    const { status } = await request(baseUrl, 'POST', '/subscribe', {
      endpoint: 'https://push.example.com/abc',
      keys: { p256dh: 'p', auth: 'a' },
    });
    await closeServer(server);
    expect(status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    ({ server, baseUrl } = await buildTestServer());
    const { status, body } = await request(baseUrl, 'POST', '/subscribe', {
      endpoint: 'not-a-url',
      keys: { p256dh: '', auth: '' },
    });
    await closeServer(server);
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe('Invalid subscription');
  });

  it('stores the subscription and returns 201', async () => {
    const saved = {
      id: 'sub-1',
      user_id: 'user-1',
      endpoint: 'https://push.example.com/abc',
    };
    mockFrom.mockReturnValue(makeChain({ data: saved, error: null }));

    ({ server, baseUrl } = await buildTestServer());
    const { status, body } = await request(baseUrl, 'POST', '/subscribe', {
      endpoint: 'https://push.example.com/abc',
      keys: { p256dh: 'p', auth: 'a' },
    });
    await closeServer(server);

    expect(status).toBe(201);
    expect((body as { id: string }).id).toBe('sub-1');
    expect(mockFrom).toHaveBeenCalledWith('push_subscriptions');
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'boom' } }));
    ({ server, baseUrl } = await buildTestServer());
    const { status } = await request(baseUrl, 'POST', '/subscribe', {
      endpoint: 'https://push.example.com/abc',
      keys: { p256dh: 'p', auth: 'a' },
    });
    await closeServer(server);
    expect(status).toBe(500);
  });
});

describe('DELETE /unsubscribe', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(() => {
    currentUser = { id: 'user-1', email: 'u@example.com', tier: 'free' };
    mockFrom.mockReset();
  });

  it('removes the subscription and returns 204', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
    ({ server, baseUrl } = await buildTestServer());
    const { status } = await request(baseUrl, 'DELETE', '/unsubscribe', {
      endpoint: 'https://push.example.com/abc',
    });
    await closeServer(server);
    expect(status).toBe(204);
    expect(mockFrom).toHaveBeenCalledWith('push_subscriptions');
  });

  it('returns 400 for invalid body', async () => {
    ({ server, baseUrl } = await buildTestServer());
    const { status } = await request(baseUrl, 'DELETE', '/unsubscribe', {
      endpoint: 'not-a-url',
    });
    await closeServer(server);
    expect(status).toBe(400);
  });
});

describe('POST /test', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(() => {
    currentUser = { id: 'user-1', email: 'u@example.com', tier: 'pro' };
    mockFrom.mockReset();
    mockSendPush.mockReset();
  });

  it('returns 404 when user has no subscriptions', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));
    ({ server, baseUrl } = await buildTestServer());
    const { status, body } = await request(baseUrl, 'POST', '/test');
    await closeServer(server);
    expect(status).toBe(404);
    expect((body as { error: string }).error).toBe('No active subscriptions');
  });

  it('sends to every subscription and reports counts', async () => {
    const subs = [
      { endpoint: 'https://push.example.com/a', p256dh: 'p1', auth: 'a1' },
      { endpoint: 'https://push.example.com/b', p256dh: 'p2', auth: 'a2' },
    ];
    mockFrom.mockReturnValue(makeChain({ data: subs, error: null }));
    mockSendPush.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    ({ server, baseUrl } = await buildTestServer());
    const { status, body } = await request(baseUrl, 'POST', '/test');
    await closeServer(server);

    expect(status).toBe(200);
    expect(body).toEqual({ sent: 1, failed: 1, total: 2 });
    expect(mockSendPush).toHaveBeenCalledTimes(2);
    // First arg shape: { endpoint, keys: { p256dh, auth } }
    expect(mockSendPush.mock.calls[0][0]).toEqual({
      endpoint: 'https://push.example.com/a',
      keys: { p256dh: 'p1', auth: 'a1' },
    });
  });

  it('returns 500 when fetch fails', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'boom' } }));
    ({ server, baseUrl } = await buildTestServer());
    const { status } = await request(baseUrl, 'POST', '/test');
    await closeServer(server);
    expect(status).toBe(500);
  });
});
