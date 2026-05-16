import { describe, it, expect, vi } from 'vitest';
import { getTierLimits, getUserTier, requiresTier } from '../tier.js';
import type { Request, Response, NextFunction } from 'express';

function mockReq(user?: { id?: string; tier?: string }): Request {
  return { user } as unknown as Request;
}

describe('getTierLimits', () => {
  it('anonymous gets 30 requests per window', () => {
    expect(getTierLimits('anonymous').requestsPerWindow).toBe(30);
  });

  it('free gets 100 requests per window', () => {
    expect(getTierLimits('free').requestsPerWindow).toBe(100);
  });

  it('pro gets 1000 requests per window', () => {
    expect(getTierLimits('pro').requestsPerWindow).toBe(1000);
  });

  it('pro has nowcast access', () => {
    expect(getTierLimits('pro').nowcastAccess).toBe(true);
  });

  it('free does not have nowcast access', () => {
    expect(getTierLimits('free').nowcastAccess).toBe(false);
  });
});

describe('getUserTier', () => {
  it('returns anonymous when no user', () => {
    expect(getUserTier(mockReq())).toBe('anonymous');
  });

  it('returns free for authenticated user without pro', () => {
    expect(getUserTier(mockReq({ id: 'abc', tier: 'free' }))).toBe('free');
  });

  it('returns pro for pro user', () => {
    expect(getUserTier(mockReq({ id: 'abc', tier: 'pro' }))).toBe('pro');
  });
});

describe('requiresTier middleware', () => {
  it('allows pro user to access pro route', () => {
    const req = mockReq({ id: 'abc', tier: 'pro' });
    const next = vi.fn() as unknown as NextFunction;
    const res = {} as Response;
    requiresTier('pro')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks free user from pro route', () => {
    const req = mockReq({ id: 'abc', tier: 'free' });
    const jsonFn = vi.fn();
    const res = { status: vi.fn().mockReturnValue({ json: jsonFn }) } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;
    requiresTier('pro')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows free user to access free route', () => {
    const req = mockReq({ id: 'abc', tier: 'free' });
    const next = vi.fn() as unknown as NextFunction;
    const res = {} as Response;
    requiresTier('free')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
