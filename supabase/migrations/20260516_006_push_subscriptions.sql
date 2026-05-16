-- Migration: 006_push_subscriptions
-- Stores Web Push (VAPID) subscription endpoints for each authenticated user.
-- One user may have multiple subscriptions (e.g., multiple devices/browsers).
-- The backend service role iterates this table to dispatch severe-weather alerts.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL,
  p256dh      TEXT        NOT NULL,
  auth        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A given push endpoint URL is globally unique (issued by the browser's push service).
  -- This also lets us safely upsert when a client re-subscribes.
  UNIQUE (endpoint)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

-- ── Row-Level Security ─────────────────────────────────────────────────────────
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can SELECT, INSERT, UPDATE, and DELETE only their own subscription rows.
CREATE POLICY "Users can manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- The service role (used by the alert-pusher background job) has unrestricted access.
CREATE POLICY "Service role manages push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
