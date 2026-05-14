/**
 * HTTP request/response structured logging middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../lib/logger.js';
import { generateRequestId } from '../lib/request-id.js';

const logger = createLogger('http');

// Augment Express Request to carry requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = generateRequestId();
  req.requestId = requestId;

  const startTime = Date.now();

  logger.info(
    {
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    },
    'Request started'
  );

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(
      {
        requestId,
        statusCode: res.statusCode,
        duration,
      },
      'Request finished'
    );
  });

  next();
}
