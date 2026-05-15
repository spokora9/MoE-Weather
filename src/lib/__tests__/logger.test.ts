import { describe, it, expect } from 'vitest';
import { createLogger } from '../logger.js';
import { generateRequestId } from '../request-id.js';

describe('createLogger', () => {
  it('returns an object with expected log-level methods', () => {
    const log = createLogger('test');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.trace).toBe('function');
  });

  it('child logger carries the component field in bindings', () => {
    const log = createLogger('test-component');
    const bindings = log.bindings();
    expect(bindings.component).toBe('test-component');
  });

  it('different components produce distinct loggers', () => {
    const logA = createLogger('component-a');
    const logB = createLogger('component-b');
    expect(logA.bindings().component).toBe('component-a');
    expect(logB.bindings().component).toBe('component-b');
  });
});

describe('generateRequestId', () => {
  it('returns a string of exactly 8 characters', () => {
    const id = generateRequestId();
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(8);
  });

  it('returns only alphanumeric characters', () => {
    const id = generateRequestId();
    expect(/^[0-9a-f]{8}$/.test(id)).toBe(true);
  });

  it('generates unique ids across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
    expect(ids.size).toBe(100);
  });
});
