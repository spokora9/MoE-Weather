-- Migration: 004_user_preferences
-- One-row-per-user settings for display, localisation, and notification preferences.
-- The row is created lazily on first save; the app must handle the case where no
-- row exists yet (treat as all-defaults).

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id              UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_system          TEXT        NOT NULL DEFAULT 'metric'
                         CHECK (unit_system IN ('metric', 'imperial', 'uk')),
  language             TEXT        NOT NULL DEFAULT 'en',
  push_alerts_enabled  BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Web Push / FCM subscription payload stored as opaque JSON.
  push_subscription    JSONB,
  theme                TEXT        NOT NULL DEFAULT 'system'
                         CHECK (theme IN ('light', 'dark', 'system')),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row-Level Security ─────────────────────────────────────────────────────────
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can SELECT, INSERT, UPDATE, and DELETE their own preference row.
CREATE POLICY "Users can manage own preferences"
  ON public.user_preferences
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- The service role has unrestricted access.
CREATE POLICY "Service role manages user preferences"
  ON public.user_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
