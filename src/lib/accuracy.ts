/**
 * Forecast accuracy computation helpers.
 *
 * Pure math helpers + Supabase-backed queries used by the accuracy tracker
 * job and the consensus engine's weight tuner.
 *
 * - computeMAE / computeRMSE / computeBias  - pure stat functions
 * - getProviderAccuracy                     - aggregates from
 *                                             forecast_accuracy_log table
 * - suggestWeightAdjustments                - converts inverse-MAE into
 *                                             a normalized weight map
 *                                             (sums to 1.0 across providers
 *                                             for a single metric)
 */

import type { WeatherProvider } from '../types/weather.js';
import { supabaseAdmin } from './supabase.js';
import { createLogger } from './logger.js';

const logger = createLogger('accuracy');

export type AccuracyMetric = 'temperature' | 'precipitation' | 'wind_speed';

export interface ProviderAccuracyStats {
  mae: number;
  rmse: number;
  bias: number;
  samples: number;
}

function assertSameLength(predictions: number[], actuals: number[]): void {
  if (predictions.length !== actuals.length) {
    throw new Error(
      `predictions and actuals must have equal length (got ${predictions.length} vs ${actuals.length})`
    );
  }
}

/**
 * Mean Absolute Error: mean(|p - a|).
 * Returns 0 for empty input (rather than NaN) so downstream weight math
 * is well-defined when a provider has no samples yet.
 */
export function computeMAE(predictions: number[], actuals: number[]): number {
  assertSameLength(predictions, actuals);
  if (predictions.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    sum += Math.abs(predictions[i] - actuals[i]);
  }
  return sum / predictions.length;
}

/**
 * Root Mean Squared Error: sqrt(mean((p - a)^2)).
 */
export function computeRMSE(predictions: number[], actuals: number[]): number {
  assertSameLength(predictions, actuals);
  if (predictions.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    const d = predictions[i] - actuals[i];
    sum += d * d;
  }
  return Math.sqrt(sum / predictions.length);
}

/**
 * Signed mean error (bias): mean(p - a).
 * Positive = provider over-predicts; negative = under-predicts.
 */
export function computeBias(predictions: number[], actuals: number[]): number {
  assertSameLength(predictions, actuals);
  if (predictions.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    sum += predictions[i] - actuals[i];
  }
  return sum / predictions.length;
}

/**
 * Query Supabase for a provider's accuracy over the last `lookbackDays`.
 *
 * Only rows where both predicted_value and actual_value are non-null are
 * considered. If Supabase isn't configured or no samples exist, returns
 * zeroed stats with samples=0 (caller decides how to handle).
 */
export async function getProviderAccuracy(
  provider: WeatherProvider,
  metric: AccuracyMetric,
  lookbackDays = 7
): Promise<ProviderAccuracyStats> {
  const empty: ProviderAccuracyStats = { mae: 0, rmse: 0, bias: 0, samples: 0 };

  if (!supabaseAdmin) {
    logger.warn('Supabase admin client not configured; returning zero stats');
    return empty;
  }

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('forecast_accuracy_log')
    .select('predicted_value, actual_value')
    .eq('provider', provider)
    .eq('metric', metric)
    .gte('target_time', since)
    .not('predicted_value', 'is', null)
    .not('actual_value', 'is', null);

  if (error) {
    logger.error({ err: error, provider, metric }, 'Failed to query accuracy log');
    return empty;
  }

  const rows = (data ?? []) as Array<{
    predicted_value: number | null;
    actual_value: number | null;
  }>;

  const predictions: number[] = [];
  const actuals: number[] = [];
  for (const row of rows) {
    if (row.predicted_value !== null && row.actual_value !== null) {
      predictions.push(Number(row.predicted_value));
      actuals.push(Number(row.actual_value));
    }
  }

  return {
    mae: computeMAE(predictions, actuals),
    rmse: computeRMSE(predictions, actuals),
    bias: computeBias(predictions, actuals),
    samples: predictions.length,
  };
}

/**
 * Convert per-provider MAE into a normalized weight map for a single metric.
 *
 * Algorithm:
 *  1. For each provider with samples, weight_raw = 1 / (MAE + epsilon).
 *     Lower MAE -> higher weight.
 *  2. Providers with 0 samples are skipped (no signal).
 *  3. Normalize so weights sum to exactly 1.0.
 *
 * If no provider has samples, returns {} (caller should fall back to defaults).
 */
export async function suggestWeightAdjustments(
  metric: AccuracyMetric,
  providers: WeatherProvider[] = [
    'open-meteo',
    'nws',
    'openweathermap',
    'weatherapi',
    'tomorrow-io',
    'bright-sky',
    'met-norway',
    'eccc-canada',
    'pirate-weather',
  ],
  lookbackDays = 7
): Promise<Record<string, number>> {
  const epsilon = 1e-3;
  const inverseMae: Record<string, number> = {};

  for (const provider of providers) {
    const stats = await getProviderAccuracy(provider, metric, lookbackDays);
    if (stats.samples > 0) {
      inverseMae[provider] = 1 / (stats.mae + epsilon);
    }
  }

  const total = Object.values(inverseMae).reduce((s, v) => s + v, 0);
  if (total === 0) return {};

  const normalized: Record<string, number> = {};
  for (const [provider, raw] of Object.entries(inverseMae)) {
    normalized[provider] = raw / total;
  }
  return normalized;
}
