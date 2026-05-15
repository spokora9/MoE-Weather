-- Migration: 002_saved_locations
-- Stores the list of weather locations a user has pinned in the app.
-- Each user can mark at most one location as their default (enforced in app logic).

CREATE TABLE IF NOT EXISTS public.saved_locations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  latitude      NUMERIC(9,6) NOT NULL
                  CHECK (latitude  >= -90  AND latitude  <= 90),
  longitude     NUMERIC(9,6) NOT NULL
                  CHECK (longitude >= -180 AND longitude <= 180),
  country       TEXT,
  is_default    BOOLEAN     NOT NULL DEFAULT FALSE,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_saved_locations_user_id
  ON public.saved_locations(user_id);

-- Supports ordering the location list without a sequential scan.
CREATE INDEX IF NOT EXISTS idx_saved_locations_user_order
  ON public.saved_locations(user_id, display_order);

-- ── Row-Level Security ─────────────────────────────────────────────────────────
ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;

-- Users can SELECT, INSERT, UPDATE, and DELETE their own location rows.
CREATE POLICY "Users can manage own locations"
  ON public.saved_locations
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- The service role has unrestricted access (e.g., admin cleanup jobs).
CREATE POLICY "Service role manages saved locations"
  ON public.saved_locations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
