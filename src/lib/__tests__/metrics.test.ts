import { describe, it, expect, beforeEach } from 'vitest';
import { metrics, METRICS } from '../metrics.js';

describe('MetricsRegistry', () => {
  beforeEach(() => metrics.reset());

  it('increments a counter', () => {
    metrics.increment(METRICS.CACHE_HITS, { type: 'current' });
    metrics.increment(METRICS.CACHE_HITS, { type: 'current' });
    const output = metrics.render();
    expect(output).toContain('weather_cache_hits_total{type="current"} 2');
  });

  it('increments different label sets independently', () => {
    metrics.increment(METRICS.CACHE_HITS, { type: 'current' });
    metrics.increment(METRICS.CACHE_HITS, { type: 'hourly' });
    const output = metrics.render();
    expect(output).toContain('{type="current"} 1');
    expect(output).toContain('{type="hourly"} 1');
  });

  it('records histogram observations', () => {
    metrics.observe(METRICS.REQUEST_DURATION, 150);
    const output = metrics.render();
    expect(output).toContain('weather_request_duration_ms_count 1');
    expect(output).toContain('weather_request_duration_ms_sum 150');
  });

  it('renders prometheus format with TYPE and HELP lines', () => {
    metrics.increment(METRICS.PROVIDER_REQUESTS, { provider: 'open-meteo', status: 'success' });
    const output = metrics.render();
    expect(output).toContain('# TYPE weather_provider_requests_total counter');
    expect(output).toContain('# HELP weather_provider_requests_total');
  });

  it('reset clears all metrics', () => {
    metrics.increment(METRICS.CACHE_HITS);
    metrics.reset();
    expect(metrics.render().trim()).toBe('');
  });
});
