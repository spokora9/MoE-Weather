/**
 * Structured logging using pino
 * Singleton logger with development pretty-printing and production JSON output
 */

import pino from 'pino';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve package.json to get version
const require = createRequire(import.meta.url);
// Walk up two levels: src/lib -> src -> project root
const pkg = require(path.join(__dirname, '../../package.json')) as { version: string };

const isDevelopment = process.env.NODE_ENV !== 'production';

const baseLogger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: {
      service: 'moe-weather',
      version: pkg.version,
    },
    ...(isDevelopment
      ? {}
      : {
          // In production emit raw JSON; no special serializers needed beyond defaults
          timestamp: pino.stdTimeFunctions.isoTime,
        }),
  },
  isDevelopment
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      })
    : undefined
);

export const logger = baseLogger;

/**
 * Create a child logger bound to a named component.
 *
 * Usage:
 *   const logger = createLogger('adapter:nws');
 *   logger.info({ lat, lon }, 'Fetching NWS data');
 */
export function createLogger(component: string): pino.Logger {
  return baseLogger.child({ component });
}
