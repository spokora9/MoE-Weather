-- Migration: 005_forecast_accuracy
-- Append-only log used to measure forecast provider accuracy over time.
-- Written exclusively by the backend service role; no user-facing reads via RLS
-- (aggregates are served through API endpoints, not direct table access).

CREATE TABLE IF NOT EXISTS public.forecast_accuracy_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT        NOT NULL,
  latitude        NUMERIC(9,6) NOT NULL,
  longitude       NUMERIC(9,6) NOT NULL,
  forecast_time   TIMESTAMPTZ NOT NULL,   -- when the forecast was issued
  target_time     TIMESTAMPTZ NOT NULL,   -- the hour/day being predicted
  metric          TEXT        NOT NULL
                    CHECK (metric IN ('temperature', 'precipitation', 'wind_speed')),
  predicted_value NUMERIC,
  actual_value    NUMERIC,
  -- Absolute error = |predicted - actual|; may be NULL until actual is observed.
  absolute_error  NUMERIC
                    GENERATED ALWAYS AS (ABS(predicted_value - actual_value)) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_accuracy_provider
  ON public.forecast_accuracy_log(provider);

CREATE INDEX IF NOT EXISTS idx_accuracy_target_time
  ON public.forecast_accuracy_log(target_time);

CREATE INDEX IF NOT EXISTS idx_accuracy_metric
  ON public.forecast_accuracy_log(metric);

-- Composite index for the most common aggregation query pattern.
CREATE INDEX IF NOT EXISTS idx_accuracy_provider_metric_target
  ON public.forecast_accuracy_log(provider, metric, target_time);

-- ── Row-Level Security ─────────────────────────────────────────────────────────
-- RLS is enabled but no authenticated-user policies are created.
-- All reads and writes are performed by the service role only.
ALTER TABLE public.forecast_accuracy_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages accuracy log"
  ON public.forecast_accuracy_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
