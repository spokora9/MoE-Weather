import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { rateLimitMiddleware } from '../rate-limit.js';

// Helper to build a minimal mock Request
function makeReq(overrides: Partial<Request> & { user?: { id: string; tier?: string } } = {}): Request {
  return {
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

// Helper to build a mock Response that captures headers and status/json calls
function makeRes() {
  const headers: Record<string, string | number> = {};
  let statusCode = 200;
  let body: unknown = null;

  const res = {
    setHeader: (name: string, value: string | number) => { headers[name] = value; },
    status: (code: number) => { statusCode = code; return res; },
    json: (data: unknown) => { body = data; },
    _headers: headers,
    get statusCode() { return statusCode; },
    get body() { return body; },
  } as unknown as Response & { _headers: Record<string, string | number>; statusCode: number; body: unknown };

  return res;
}

// Reset the in-memory store between tests by manipulating Date.now so all
// entries appear expired, forcing the store to reinitialise on the next call.
beforeEach(() => {
  // Advance fake time far into the future so previous window entries expire
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 60 * 60 * 1000); // +1 hour — clears all windows
});

// Unique IP counter so each test gets a fresh key
let ipCounter = 0;
function freshIp(): string {
  return `10.0.0.${++ipCounter}`;
}

// ---------------------------------------------------------------------------
// 1. Anonymous user: blocked after 30 requests
// ---------------------------------------------------------------------------
describe('anonymous tier', () => {
  it('allows the first 30 requests and blocks the 31st', () => {
    const ip = freshIp();
    const next = vi.fn() as unknown as NextFunction;

    for (let i = 1; i <= 30; i++) {
      const req = makeReq({ ip });
      const res = makeRes();
      rateLimitMiddleware(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(30);

    // 31st request should be blocked
    const req31 = makeReq({ ip });
    const res31 = makeRes();
    rateLimitMiddleware(\1, \2, vi.fn() as unknown as any);

    expect(res31.statusCode).toBe(429);
    expect((res31.body as any).error).toBe('Too many requests');
  });
});

// ---------------------------------------------------------------------------
// 2. Free user: blocked after 100 requests
// ---------------------------------------------------------------------------
describe('free tier', () => {
  it('allows 100 requests and blocks the 101st', () => {
    const ip = freshIp();
    const userId = 'free-user-1';
    const next = vi.fn() as unknown as NextFunction;

    for (let i = 1; i <= 100; i++) {
      const req = makeReq({ ip, user: { id: userId } } as any);
      const res = makeRes();
      rateLimitMiddleware(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(100);

    // 101st request should be blocked
    const req101 = makeReq({ ip, user: { id: userId } } as any);
    const res101 = makeRes();
    rateLimitMiddleware(\1, \2, vi.fn() as unknown as any);

    expect(res101.statusCode).toBe(429);
    expect((res101.body as any).retryAfter).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Pro user: 100 consecutive requests all pass
// ---------------------------------------------------------------------------
describe('pro tier', () => {
  it('allows 100 consecutive requests without blocking', () => {
    const ip = freshIp();
    const userId = 'pro-user-1';
    const next = vi.fn() as unknown as NextFunction;

    for (let i = 1; i <= 100; i++) {
      const req = makeReq({ ip, user: { id: userId, tier: 'pro' } } as any);
      const res = makeRes();
      rateLimitMiddleware(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(100);
  });
});

// ---------------------------------------------------------------------------
// 4. Headers set correctly
// ---------------------------------------------------------------------------
describe('rate-limit headers', () => {
  it('sets X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset', () => {
    const ip = freshIp();
    const req = makeReq({ ip });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    rateLimitMiddleware(req, res, next);

    const headers = (res as any)._headers as Record<string, string | number>;
    expect(headers['X-RateLimit-Limit']).toBe(30);         // anonymous limit
    expect(typeof headers['X-RateLimit-Remaining']).toBe('number');
    expect(typeof headers['X-RateLimit-Reset']).toBe('number');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('decrements X-RateLimit-Remaining on each request', () => {
    const ip = freshIp();
    const next = vi.fn() as unknown as NextFunction;

    const res1 = makeRes();
    rateLimitMiddleware(makeReq({ ip }), res1, next);
    const remaining1 = (res1 as any)._headers['X-RateLimit-Remaining'] as number;

    const res2 = makeRes();
    rateLimitMiddleware(makeReq({ ip }), res2, next);
    const remaining2 = (res2 as any)._headers['X-RateLimit-Remaining'] as number;

    expect(remaining2).toBe(remaining1 - 1);
  });
});

// ---------------------------------------------------------------------------
// 5. Returns 429 with retryAfter when exceeded
// ---------------------------------------------------------------------------
describe('429 response', () => {
  it('returns 429 JSON with retryAfter field when limit exceeded', () => {
    const ip = freshIp();
    const next = vi.fn() as unknown as NextFunction;

    // Exhaust the anonymous limit (30 requests)
    for (let i = 0; i < 30; i++) {
      rateLimitMiddleware(makeReq({ ip }), makeRes(), next);
    }

    const res = makeRes();
    rateLimitMiddleware(\1, \2, vi.fn() as unknown as any);

    expect(res.statusCode).toBe(429);
    const body = res.body as any;
    expect(body.error).toBe('Too many requests');
    expect(typeof body.retryAfter).toBe('number');
    expect(body.retryAfter).toBeGreaterThan(0);
  });
});
