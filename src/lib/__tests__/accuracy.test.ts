import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocked Supabase admin client. Tests reset/redefine this between runs.
const supabaseState: {
  rows: Array<{ predicted_value: number | null; actual_value: number | null }>;
  error: Error | null;
  lastFilters: Record<string, unknown>;
} = { rows: [], error: null, lastFilters: {} };

function makeQueryBuilder() {
  // Each chained call records the filter and returns the same builder so
  // we can await it like a promise at the end of the chain.
  const builder: Record<string, unknown> = {
    select: vi.fn().mockImplementation(() => builder),
    eq: vi.fn().mockImplementation((col: string, val: unknown) => {
      supabaseState.lastFilters[`eq:${col}`] = val;
      return builder;
    }),
    gte: vi.fn().mockImplementation((col: string, val: unknown) => {
      supabaseState.lastFilters[`gte:${col}`] = val;
      return builder;
    }),
    not: vi.fn().mockImplementation(() => builder),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve({ data: supabaseState.rows, error: supabaseState.error })),
  };
  return builder;
}

vi.mock('../supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
  supabase: null,
  isSupabaseConfigured: () => true,
}));

import * as supabaseModule from '../supabase.js';
import {
  computeMAE,
  computeRMSE,
  computeBias,
  getProviderAccuracy,
  suggestWeightAdjustments,
} from '../accuracy.js';

beforeEach(() => {
  supabaseState.rows = [];
  supabaseState.error = null;
  supabaseState.lastFilters = {};
  // Reinstall a default chainable builder before every test so prior
  // mock overrides don't leak.
  (supabaseModule.supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from = vi
    .fn()
    .mockImplementation(() => makeQueryBuilder());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('computeMAE', () => {
  it('returns 0 for empty arrays', () => {
    expect(computeMAE([], [])).toBe(0);
  });

  it('returns 0 when prediction matches actual', () => {
    expect(computeMAE([5, 5, 5], [5, 5, 5])).toBe(0);
  });

  it('computes mean of absolute errors', () => {
    // errors: |10-8|, |20-15|, |30-30| = 2, 5, 0 -> mean = 7/3
    expect(computeMAE([10, 20, 30], [8, 15, 30])).toBeCloseTo(7 / 3, 10);
  });

  it('treats sign-flipped errors equally', () => {
    expect(computeMAE([5, 5], [3, 7])).toBe(2);
  });

  it('throws on mismatched lengths', () => {
    expect(() => computeMAE([1, 2], [1])).toThrow(/equal length/);
  });
});

describe('computeRMSE', () => {
  it('returns 0 for empty arrays', () => {
    expect(computeRMSE([], [])).toBe(0);
  });

  it('penalizes larger errors more than MAE', () => {
    // errors: 0, 0, 10 -> RMSE = sqrt(100/3) ≈ 5.77, MAE = 10/3 ≈ 3.33
    const rmse = computeRMSE([0, 0, 10], [0, 0, 0]);
    const mae = computeMAE([0, 0, 10], [0, 0, 0]);
    expect(rmse).toBeGreaterThan(mae);
    expect(rmse).toBeCloseTo(Math.sqrt(100 / 3), 10);
  });

  it('matches MAE when all errors equal', () => {
    expect(computeRMSE([5, 5, 5], [3, 3, 3])).toBe(2);
  });
});

describe('computeBias', () => {
  it('returns 0 for empty arrays', () => {
    expect(computeBias([], [])).toBe(0);
  });

  it('is positive when over-predicting', () => {
    expect(computeBias([10, 12], [8, 10])).toBe(2);
  });

  it('is negative when under-predicting', () => {
    expect(computeBias([8, 10], [10, 12])).toBe(-2);
  });

  it('cancels symmetric errors', () => {
    expect(computeBias([10, 8], [8, 10])).toBe(0);
  });
});

describe('getProviderAccuracy', () => {
  it('returns zero stats when no rows', async () => {
    supabaseState.rows = [];
    const stats = await getProviderAccuracy('open-meteo', 'temperature', 7);
    expect(stats).toEqual({ mae: 0, rmse: 0, bias: 0, samples: 0 });
  });

  it('aggregates non-null rows into MAE/RMSE/bias', async () => {
    supabaseState.rows = [
      { predicted_value: 10, actual_value: 8 },
      { predicted_value: 20, actual_value: 22 },
      { predicted_value: 30, actual_value: 30 },
    ];
    const stats = await getProviderAccuracy('open-meteo', 'temperature', 7);
    expect(stats.samples).toBe(3);
    expect(stats.mae).toBeCloseTo((2 + 2 + 0) / 3, 10);
    expect(stats.bias).toBeCloseTo((2 + -2 + 0) / 3, 10);
    expect(stats.rmse).toBeCloseTo(Math.sqrt((4 + 4 + 0) / 3), 10);
  });

  it('filters out rows with null values', async () => {
    supabaseState.rows = [
      { predicted_value: 10, actual_value: 8 },
      { predicted_value: null, actual_value: 7 },
      { predicted_value: 20, actual_value: null },
    ];
    const stats = await getProviderAccuracy('open-meteo', 'temperature', 7);
    expect(stats.samples).toBe(1);
    expect(stats.mae).toBe(2);
  });

  it('returns zero stats when supabase returns an error', async () => {
    supabaseState.error = new Error('boom');
    const stats = await getProviderAccuracy('open-meteo', 'temperature', 7);
    expect(stats).toEqual({ mae: 0, rmse: 0, bias: 0, samples: 0 });
  });

  it('applies provider and metric filters', async () => {
    await getProviderAccuracy('nws', 'precipitation', 14);
    expect(supabaseState.lastFilters['eq:provider']).toBe('nws');
    expect(supabaseState.lastFilters['eq:metric']).toBe('precipitation');
    expect(supabaseState.lastFilters['gte:target_time']).toBeDefined();
  });
});

describe('suggestWeightAdjustments', () => {
  it('returns weights that sum to 1.0 across providers with samples', async () => {
    // Two providers, A has MAE 1, B has MAE 4. Inverse: ~1 and ~0.25.
    // Normalized: ~0.8 and ~0.2.
    let call = 0;
    const mocked: Array<typeof supabaseState.rows> = [
      [
        { predicted_value: 10, actual_value: 9 },
        { predicted_value: 20, actual_value: 19 },
      ],
      [
        { predicted_value: 10, actual_value: 6 },
        { predicted_value: 20, actual_value: 16 },
      ],
    ];

    // Override the mock to feed different rows per call.
    (supabaseModule.supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from = vi
      .fn()
      .mockImplementation(() => {
        supabaseState.rows = mocked[call++] ?? [];
        return makeQueryBuilder();
      });

    const weights = await suggestWeightAdjustments(
      'temperature',
      ['open-meteo', 'nws']
    );
    const total = Object.values(weights).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(weights['open-meteo']).toBeGreaterThan(weights['nws']);
  });

  it('returns empty object when no provider has samples', async () => {
    supabaseState.rows = [];
    const weights = await suggestWeightAdjustments(
      'temperature',
      ['open-meteo', 'nws']
    );
    expect(weights).toEqual({});
  });

  it('weights inversely proportional to MAE', async () => {
    // Equal MAE -> equal weights.
    let call = 0;
    const mocked: Array<typeof supabaseState.rows> = [
      [{ predicted_value: 10, actual_value: 9 }], // MAE=1
      [{ predicted_value: 10, actual_value: 9 }], // MAE=1
    ];
    (supabaseModule.supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from = vi
      .fn()
      .mockImplementation(() => {
        supabaseState.rows = mocked[call++] ?? [];
        return makeQueryBuilder();
      });

    const weights = await suggestWeightAdjustments(
      'temperature',
      ['open-meteo', 'nws']
    );
    expect(weights['open-meteo']).toBeCloseTo(0.5, 6);
    expect(weights['nws']).toBeCloseTo(0.5, 6);
  });
});
