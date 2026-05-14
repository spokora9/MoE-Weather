/**
 * Minimal structured logger — console-based wrapper.
 * Compatible with the createLogger(name) API used across the codebase.
 */

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogObject {
  [key: string]: unknown;
}

interface ChildLogger {
  trace(obj: LogObject | string, msg?: string): void;
  debug(obj: LogObject | string, msg?: string): void;
  info(obj: LogObject | string, msg?: string): void;
  warn(obj: LogObject | string, msg?: string): void;
  error(obj: LogObject | string, msg?: string): void;
  fatal(obj: LogObject | string, msg?: string): void;
}

function makeLogger(name: string): ChildLogger {
  function log(level: LogLevel, obj: LogObject | string, msg?: string): void {
    const timestamp = new Date().toISOString();
    const message = typeof obj === 'string' ? obj : (msg ?? '');
    const extra = typeof obj === 'object' ? JSON.stringify(obj) : '';
    const line = `[${timestamp}] ${level.toUpperCase()} (${name}): ${message} ${extra}`.trimEnd();
    if (level === 'error' || level === 'fatal') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  return {
    trace: (obj, msg) => log('trace', obj, msg),
    debug: (obj, msg) => log('debug', obj, msg),
    info:  (obj, msg) => log('info',  obj, msg),
    warn:  (obj, msg) => log('warn',  obj, msg),
    error: (obj, msg) => log('error', obj, msg),
    fatal: (obj, msg) => log('fatal', obj, msg),
  };
}

export function createLogger(name: string): ChildLogger {
  return makeLogger(name);
}

export const logger = makeLogger('app');
