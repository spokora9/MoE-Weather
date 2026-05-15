-- Migration: 003_subscriptions
-- Records the current (and historical) subscription state for each user.
-- Rows are written by the backend webhook handler using the service role;
-- users may only read their own subscription rows.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider    TEXT        NOT NULL DEFAULT 'revenuecat'
                CHECK (provider IN ('revenuecat', 'stripe', 'manual')),
  status      TEXT        NOT NULL
                CHECK (status IN ('active', 'expired', 'canceled', 'in_grace', 'in_trial')),
  product_id  TEXT,
  period_end  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions(status);

-- Useful for finding soon-to-expire subscriptions in background jobs.
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end
  ON public.subscriptions(period_end)
  WHERE period_end IS NOT NULL;

-- ── Row-Level Security ─────────────────────────────────────────────────────────
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read their own subscription rows (read-only).
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only the service role (webhook handler) may create or modify subscription rows.
CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
