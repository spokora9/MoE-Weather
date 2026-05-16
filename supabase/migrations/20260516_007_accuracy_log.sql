-- Migration: 007_accuracy_log
-- Wave 2 Track E: extend the C2 forecast_accuracy_log table with
-- aggregation views used by the accuracy tracker job and the
-- consensus weight tuner. The base table (provider / metric /
-- predicted_value / actual_value / forecast_time / target_time /
-- absolute_error) is already created in migration 005 and is left
-- unchanged here.

-- ── Helper view: per-provider, per-metric MAE / RMSE / bias / sample count
-- over the trailing 7 days. Materializing this would be ideal, but a plain
-- view is sufficient for current write volumes and avoids a refresh job.
CREATE OR REPLACE VIEW public.mae_per_provider AS
SELECT
  provider,
  metric,
  AVG(absolute_error)                                       AS mae,
  SQRT(AVG(POWER(predicted_value - actual_value, 2)))       AS rmse,
  AVG(predicted_value - actual_value)                       AS bias,
  COUNT(*)                                                  AS samples,
  MAX(target_time)                                          AS last_observation
FROM public.forecast_accuracy_log
WHERE actual_value    IS NOT NULL
  AND predicted_value IS NOT NULL
  AND target_time >= NOW() - INTERVAL '7 days'
GROUP BY provider, metric;

COMMENT ON VIEW public.mae_per_provider IS
  'Rolling 7-day MAE/RMSE/bias per (provider, metric). Used by the consensus '
  'engine weight tuner and by accuracy dashboards. Read-only.';

-- ── Index to keep the MAE rollup cheap as the log grows. The C2 migration
-- already adds (provider, metric, target_time); we add a partial index that
-- targets the "has actual" subset where the rollup actually runs.
CREATE INDEX IF NOT EXISTS idx_accuracy_observed
  ON public.forecast_accuracy_log(provider, metric, target_time)
  WHERE actual_value IS NOT NULL;
