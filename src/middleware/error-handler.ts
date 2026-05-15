import type { Request, Response, NextFunction } from 'express';
import { Sentry } from '../lib/sentry.js';
import { createLogger } from '../lib/logger.js';
import { metrics } from '../lib/metrics.js';

const logger = createLogger('middleware:error');

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as Request & { requestId?: string }).requestId;
  logger.error({ err, requestId, url: req.url }, 'Unhandled error');
  metrics.increment('http_errors_total', { method: req.method, status: '500' });
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  res.status(500).json({
    error: 'Internal server error',
    requestId,
  });
}
