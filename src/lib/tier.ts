import type { Request } from 'express';
import { createLogger } from './logger.js';

const logger = createLogger('tier');

export type SubscriptionTier = 'anonymous' | 'free' | 'pro';

export interface TierLimits {
  requestsPerWindow: number;
  windowMs: number;
  savedLocations: number;
  nowcastAccess: boolean;
  alertsAccess: boolean;
  forecastDays: number;
}

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  anonymous: {
    requestsPerWindow: 30,
    windowMs: 15 * 60 * 1000,
    savedLocations: 0,
    nowcastAccess: false,
    alertsAccess: false,
    forecastDays: 3,
  },
  free: {
    requestsPerWindow: 100,
    windowMs: 15 * 60 * 1000,
    savedLocations: 1,
    nowcastAccess: false,
    alertsAccess: true,
    forecastDays: 7,
  },
  pro: {
    requestsPerWindow: 1000,
    windowMs: 15 * 60 * 1000,
    savedLocations: Infinity,
    nowcastAccess: true,
    alertsAccess: true,
    forecastDays: 14,
  },
};

export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIER_LIMITS[tier];
}

export function getUserTier(req: Request): SubscriptionTier {
  const user = (req as Request & { user?: { tier?: string; id?: string } }).user;
  if (!user?.id) return 'anonymous';
  const tier = user.tier;
  if (tier === 'pro') return 'pro';
  return 'free';
}

export function requiresTier(
  minimumTier: SubscriptionTier
): (req: Request, res: import('express').Response, next: import('express').NextFunction) => void {
  const tierOrder: SubscriptionTier[] = ['anonymous', 'free', 'pro'];

  return (req, res, next) => {
    const userTier = getUserTier(req);
    const userLevel = tierOrder.indexOf(userTier);
    const requiredLevel = tierOrder.indexOf(minimumTier);

    if (userLevel >= requiredLevel) {
      next();
      return;
    }

    logger.warn({ userTier, minimumTier }, 'Tier access denied');
    res.status(403).json({
      error: 'upgrade_required',
      message: `This feature requires a ${minimumTier} subscription`,
      upgradeUrl: '/api/subscription/upgrade',
    });
  };
}
