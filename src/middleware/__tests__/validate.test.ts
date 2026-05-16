import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { validate } from '../validate.js';
import { WeatherRequestSchema, GeocodeRequestSchema } from '../../schemas/weather.js';

// Minimal mock factory helpers
function makeReq(query: Record<string, unknown> = {}): Request {
  return { query, url: '/test' } as unknown as Request;
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

describe('validate middleware', () => {
  it('passes through a valid coordinate payload', () => {
    const req = makeReq({ lat: '40.7', lon: '-74.0' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    validate(WeatherRequestSchema)(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res._statusCode).toBe(200);
    // Coerced values written back onto req.query
    expect((req.query as Record<string, unknown>).lat).toBe(40.7);
    expect((req.query as Record<string, unknown>).lon).toBe(-74.0);
  });

  it('returns 400 with field error when lat=999 (out of range)', () => {
    const req = makeReq({ lat: '999', lon: '0' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    validate(WeatherRequestSchema)(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(400);
    const body = res._body as { error: string; details: { field: string; message: string }[] };
    expect(body.error).toBe('Invalid request');
    const latError = body.details.find(d => d.field === 'lat');
    expect(latError).toBeDefined();
  });

  it('returns 400 when q is below 2 chars', () => {
    const req = makeReq({ q: 'x' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    validate(GeocodeRequestSchema)(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(400);
    const body = res._body as { error: string; details: { field: string; message: string }[] };
    expect(body.error).toBe('Invalid request');
    const qError = body.details.find(d => d.field === 'q');
    expect(qError).toBeDefined();
  });

  it('NFC-normalizes and trims the q field', () => {
    // U+00E9 = precomposed é  vs  e + U+0301 (combining accent) — after NFC both become U+00E9
    const decomposed = 'e\u0301'; // NFD: 2 code points
    const req = makeReq({ q: `  ${decomposed}  ` });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    validate(GeocodeRequestSchema)(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    const parsed = (req.query as Record<string, unknown>).q as string;
    // After NFC normalization: é (U+00E9, 1 code point) and trimmed
    expect(parsed).toBe('\u00E9');
  });

  it("defaults units to 'auto' when omitted (locale-aware resolution)", () => {
    const req = makeReq({ lat: '51.5', lon: '-0.1' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    validate(WeatherRequestSchema)(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req.query as Record<string, unknown>).units).toBe('auto');
  });

  it("accepts new unit-locale values ('uk', 'canada')", () => {
    for (const u of ['uk', 'canada', 'imperial', 'metric', 'auto']) {
      const req = makeReq({ lat: '51.5', lon: '-0.1', units: u });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      validate(WeatherRequestSchema)(req as Request, res as unknown as Response, next);
      expect(next).toHaveBeenCalledOnce();
      expect((req.query as Record<string, unknown>).units).toBe(u);
    }
  });

  it('rejects invalid units value', () => {
    const req = makeReq({ lat: '51.5', lon: '-0.1', units: 'kelvin' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    validate(WeatherRequestSchema)(req as Request, res as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(400);
  });

  it('returns 400 when hourly=200 (exceeds max of 168)', () => {
    const req = makeReq({ lat: '51.5', lon: '-0.1', hourly: '200' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    validate(WeatherRequestSchema)(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(400);
    const body = res._body as { error: string; details: { field: string; message: string }[] };
    expect(body.error).toBe('Invalid request');
    const hourlyError = body.details.find(d => d.field === 'hourly');
    expect(hourlyError).toBeDefined();
  });
});
