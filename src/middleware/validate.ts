import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema, ZodError } from 'zod';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('middleware:validate');

export function validate(schema: ZodSchema, source: 'query' | 'body' | 'params' = 'query') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = (result.error as ZodError).errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      logger.warn({ errors, url: req.url }, 'Validation failed');
      res.status(400).json({ error: 'Invalid request', details: errors });
      return;
    }
    req[source] = result.data;
    next();
  };
}
