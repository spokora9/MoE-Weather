interface Counter {
  name: string;
  help: string;
  labels: Record<string, string>;
  value: number;
}

interface Histogram {
  name: string;
  help: string;
  labels: Record<string, string>;
  sum: number;
  count: number;
  buckets: Record<string, number>; // le -> count
}

class MetricsRegistry {
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();

  // Increment a counter
  increment(name: string, labels: Record<string, string> = {}, amount = 1): void {
    const key = this.makeKey(name, labels);
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += amount;
    } else {
      this.counters.set(key, { name, help: name, labels, value: amount });
    }
  }

  // Record a histogram observation (duration, size, etc.)
  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.makeKey(name, labels);
    const BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]; // ms
    const existing = this.histograms.get(key);
    if (existing) {
      existing.sum += value;
      existing.count += 1;
      for (const b of BUCKETS) {
        if (value <= b) existing.buckets[b] = (existing.buckets[b] || 0) + 1;
      }
    } else {
      const buckets: Record<string, number> = {};
      for (const b of BUCKETS) {
        buckets[b] = value <= b ? 1 : 0;
      }
      this.histograms.set(key, { name, help: name, labels, sum: value, count: 1, buckets });
    }
  }

  // Render Prometheus text format
  render(): string {
    const lines: string[] = [];
    const countersByName = new Map<string, Counter[]>();
    for (const c of this.counters.values()) {
      const arr = countersByName.get(c.name) || [];
      arr.push(c);
      countersByName.set(c.name, arr);
    }
    for (const [name, counters] of countersByName) {
      lines.push(`# HELP ${name} ${name}`);
      lines.push(`# TYPE ${name} counter`);
      for (const c of counters) {
        lines.push(`${name}${this.labelsStr(c.labels)} ${c.value}`);
      }
    }
    const histsByName = new Map<string, Histogram[]>();
    for (const h of this.histograms.values()) {
      const arr = histsByName.get(h.name) || [];
      arr.push(h);
      histsByName.set(h.name, arr);
    }
    for (const [name, hists] of histsByName) {
      lines.push(`# HELP ${name} ${name}`);
      lines.push(`# TYPE ${name} histogram`);
      for (const h of hists) {
        const BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
        for (const b of BUCKETS) {
          lines.push(`${name}_bucket${this.labelsStr({ ...h.labels, le: String(b) })} ${h.buckets[b] || 0}`);
        }
        lines.push(`${name}_bucket${this.labelsStr({ ...h.labels, le: '+Inf' })} ${h.count}`);
        lines.push(`${name}_sum${this.labelsStr(h.labels)} ${h.sum}`);
        lines.push(`${name}_count${this.labelsStr(h.labels)} ${h.count}`);
      }
    }
    return lines.join('\n') + '\n';
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  private makeKey(name: string, labels: Record<string, string>): string {
    return `${name}__${JSON.stringify(labels)}`;
  }

  private labelsStr(labels: Record<string, string>): string {
    const pairs = Object.entries(labels);
    if (pairs.length === 0) return '';
    return '{' + pairs.map(([k, v]) => `${k}="${v}"`).join(',') + '}';
  }
}

export const metrics = new MetricsRegistry();

// Predefined metric names used across the app
export const METRICS = {
  PROVIDER_REQUESTS: 'weather_provider_requests_total',
  PROVIDER_ERRORS: 'weather_provider_errors_total',
  CACHE_HITS: 'weather_cache_hits_total',
  CACHE_MISSES: 'weather_cache_misses_total',
  REQUEST_DURATION: 'weather_request_duration_ms',
  GEOCODE_REQUESTS: 'weather_geocode_requests_total',
} as const;
