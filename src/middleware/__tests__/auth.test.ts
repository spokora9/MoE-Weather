import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(headers: Record<string, string> = {}): Request {
  return {
    headers,
    user: undefined,
  } as unknown as Request;
}

function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; _statusCode: number; _body: unknown } {
  const res = {
    _statusCode: 200,
    _body: undefined as unknown,
    status: vi.fn().mockImplementation(function (code: number) {
      res._statusCode = code;
      return res;
    }),
    json: vi.fn().mockImplementation(function (body: unknown) {
      res._body = body;
      return res;
    }),
  };
  return res;
}

// ── isSupabaseConfigured ─────────────────────────────────────────────────────

describe('isSupabaseConfigured()', () => {
  it('returns false when SUPABASE_URL and SUPABASE_ANON_KEY are not set', async () => {
    // Ensure env vars are absent
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    // Re-import the module so it picks up the absent env vars
    // (vitest isolates modules per test file; we use a dynamic import with cache busting)
    vi.resetModules();
    const { isSupabaseConfigured } = await import('../../lib/supabase.js');

    expect(isSupabaseConfigured()).toBe(false);

    // Restore
    if (savedUrl !== undefined) process.env.SUPABASE_URL = savedUrl;
    if (savedKey !== undefined) process.env.SUPABASE_ANON_KEY = savedKey;
    vi.resetModules();
  });
});

// ── optionalAuth ─────────────────────────────────────────────────────────────

describe('optionalAuth middleware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls next() and leaves req.user undefined when no Authorization header is present', async () => {
    // Mock supabase as null so we avoid real network calls
    vi.doMock('../../lib/supabase.js', () => ({
      supabase: null,
      isSupabaseConfigured: () => false,
    }));

    const { optionalAuth } = await import('../auth.js');

    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await optionalAuth(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('calls next() and leaves req.user undefined when token is invalid', async () => {
    // Mock supabase.auth.getUser to return an error
    vi.doMock('../../lib/supabase.js', () => ({
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'invalid token' },
          }),
        },
      },
      isSupabaseConfigured: () => true,
    }));

    const { optionalAuth } = await import('../auth.js');

    const req = makeReq({ authorization: 'Bearer invalid.token.here' });
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await optionalAuth(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
    // Must NOT send a 401
    expect(res._statusCode).toBe(200);
  });
});

// ── requireAuth ───────────────────────────────────────────────────────────────

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no token is present', async () => {
    vi.doMock('../../lib/supabase.js', () => ({
      supabase: null,
      isSupabaseConfigured: () => false,
    }));

    const { requireAuth } = await import('../auth.js');

    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await requireAuth(req, res as unknown as Response, next);

    expect(res._statusCode).toBe(401);
    expect((res._body as { error: string }).error).toBe('Authentication required');
    expect(next).not.toHaveBeenCalled();
  });
});
