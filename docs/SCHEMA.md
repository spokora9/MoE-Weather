# MoE Weather — Database Schema

This document describes every table in the `public` schema, its purpose, columns, relationships, and Row-Level Security (RLS) policies. All tables live in a Supabase (PostgreSQL 15) project.

---

## Table of Contents

1. [profiles](#1-profiles)
2. [saved_locations](#2-saved_locations)
3. [subscriptions](#3-subscriptions)
4. [user_preferences](#4-user_preferences)
5. [forecast_accuracy_log](#5-forecast_accuracy_log)
6. [Entity-Relationship Summary](#6-entity-relationship-summary)

---

## 1. `profiles`

**Migration:** `20260516_001_users.sql`

**Purpose:** App-specific user data that extends the built-in `auth.users` table provided by Supabase Auth. A profile row is created automatically via a database trigger whenever a new user signs up.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | NO | — | Primary key; mirrors `auth.users.id`. Foreign key with `ON DELETE CASCADE`. |
| `email` | `TEXT` | YES | — | User's email address, copied from `auth.users` at signup. |
| `tier` | `TEXT` | NO | `'free'` | Subscription tier: `'free'` or `'pro'`. |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Row creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Last modification timestamp (updated by the application). |

### Constraints

- `tier` must be one of `('free', 'pro')`.

### Relationships

- **Referenced by:** `saved_locations.user_id`, `subscriptions.user_id`, `user_preferences.user_id`.

### Trigger

`on_auth_user_created` fires `AFTER INSERT ON auth.users` and calls `public.handle_new_user()`, which inserts a corresponding `profiles` row (`ON CONFLICT DO NOTHING` for idempotency).

### RLS Policies

| Policy | Operation | Role | Condition |
|---|---|---|---|
| Users can view own profile | `SELECT` | `authenticated` | `auth.uid() = id` |
| Users can update own profile | `UPDATE` | `authenticated` | `auth.uid() = id` |
| Service role manages profiles | `ALL` | `service_role` | `true` |

---

## 2. `saved_locations`

**Migration:** `20260516_002_saved_locations.sql`

**Purpose:** Stores the list of weather locations a user has pinned in the app (home city, travel destinations, etc.). Users can reorder locations and flag one as their default.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key. |
| `user_id` | `UUID` | NO | — | Owner; FK → `profiles.id` with `ON DELETE CASCADE`. |
| `name` | `TEXT` | NO | — | Human-readable place name (e.g., `"London"`). |
| `latitude` | `NUMERIC(9,6)` | NO | — | WGS-84 latitude in decimal degrees. |
| `longitude` | `NUMERIC(9,6)` | NO | — | WGS-84 longitude in decimal degrees. |
| `country` | `TEXT` | YES | — | ISO 3166-1 alpha-2 country code or full country name. |
| `is_default` | `BOOLEAN` | NO | `FALSE` | Whether this is the user's primary location. At most one row per user should be `TRUE` (enforced in application logic). |
| `display_order` | `INTEGER` | NO | `0` | Sort position in the UI location list. |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Row creation timestamp. |

### Constraints

- `latitude` must be in `[-90, 90]`.
- `longitude` must be in `[-180, 180]`.

### Indexes

| Index | Columns | Purpose |
|---|---|---|
| `idx_saved_locations_user_id` | `(user_id)` | Fast lookup of all locations for a user. |
| `idx_saved_locations_user_order` | `(user_id, display_order)` | Ordered list retrieval without a sequential scan. |

### RLS Policies

| Policy | Operation | Role | Condition |
|---|---|---|---|
| Users can manage own locations | `ALL` | `authenticated` | `auth.uid() = user_id` |
| Service role manages saved locations | `ALL` | `service_role` | `true` |

---

## 3. `subscriptions`

**Migration:** `20260516_003_subscriptions.sql`

**Purpose:** Tracks the subscription lifecycle for each user across payment providers (RevenueCat for mobile, Stripe for web, or manual for comped accounts). Rows are written exclusively by the backend webhook handler using the service role; users can read their own rows.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key. |
| `user_id` | `UUID` | NO | — | Owner; FK → `profiles.id` with `ON DELETE CASCADE`. |
| `provider` | `TEXT` | NO | `'revenuecat'` | Payment provider: `'revenuecat'`, `'stripe'`, or `'manual'`. |
| `status` | `TEXT` | NO | — | Lifecycle state: `'active'`, `'expired'`, `'canceled'`, `'in_grace'`, or `'in_trial'`. |
| `product_id` | `TEXT` | YES | — | Provider-specific product/plan identifier. |
| `period_end` | `TIMESTAMPTZ` | YES | — | When the current billing period ends (or when the grace period expires). |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Row creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Last webhook update timestamp. |

### Indexes

| Index | Columns | Purpose |
|---|---|---|
| `idx_subscriptions_user_id` | `(user_id)` | Lookup a user's subscription history. |
| `idx_subscriptions_status` | `(status)` | Filter by lifecycle state (e.g., find all active subs). |
| `idx_subscriptions_period_end` | `(period_end)` WHERE `period_end IS NOT NULL` | Find soon-to-expire subscriptions in background jobs. |

### RLS Policies

| Policy | Operation | Role | Condition |
|---|---|---|---|
| Users can view own subscriptions | `SELECT` | `authenticated` | `auth.uid() = user_id` |
| Service role manages subscriptions | `ALL` | `service_role` | `true` |

---

## 4. `user_preferences`

**Migration:** `20260516_004_user_preferences.sql`

**Purpose:** One row per user storing display, localisation, and notification preferences. The row is created lazily on the user's first settings save; the application treats a missing row as all-defaults.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `user_id` | `UUID` | NO | — | Primary key and FK → `profiles.id` with `ON DELETE CASCADE`. |
| `unit_system` | `TEXT` | NO | `'metric'` | Measurement units: `'metric'`, `'imperial'`, or `'uk'`. |
| `language` | `TEXT` | NO | `'en'` | BCP 47 language tag for UI localisation. |
| `push_alerts_enabled` | `BOOLEAN` | NO | `FALSE` | Whether the user has opted in to push weather alerts. |
| `push_subscription` | `JSONB` | YES | — | Web Push API or FCM subscription payload (opaque JSON). |
| `theme` | `TEXT` | NO | `'system'` | Color scheme preference: `'light'`, `'dark'`, or `'system'`. |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Last modification timestamp. |

### RLS Policies

| Policy | Operation | Role | Condition |
|---|---|---|---|
| Users can manage own preferences | `ALL` | `authenticated` | `auth.uid() = user_id` |
| Service role manages user preferences | `ALL` | `service_role` | `true` |

---

## 5. `forecast_accuracy_log`

**Migration:** `20260516_005_forecast_accuracy.sql`

**Purpose:** Append-only log for measuring how accurate each weather data provider's forecasts are. The backend records both the predicted value (at forecast time) and the observed actual value (once available), then computes the absolute error. Aggregations over this table power the MoE routing algorithm's provider-selection weights.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key. |
| `provider` | `TEXT` | NO | — | Weather provider identifier (e.g., `'open-meteo'`, `'eccc'`). |
| `latitude` | `NUMERIC(9,6)` | NO | — | WGS-84 latitude of the forecast point. |
| `longitude` | `NUMERIC(9,6)` | NO | — | WGS-84 longitude of the forecast point. |
| `forecast_time` | `TIMESTAMPTZ` | NO | — | When the forecast was originally issued. |
| `target_time` | `TIMESTAMPTZ` | NO | — | The specific hour/day being predicted. |
| `metric` | `TEXT` | NO | — | Measured variable: `'temperature'`, `'precipitation'`, or `'wind_speed'`. |
| `predicted_value` | `NUMERIC` | YES | — | Provider's predicted value for the metric. |
| `actual_value` | `NUMERIC` | YES | — | Observed (ground-truth) value, filled in later. |
| `absolute_error` | `NUMERIC` | YES | `GENERATED` | `ABS(predicted_value - actual_value)`, computed automatically as a stored generated column. `NULL` while `actual_value` is not yet known. |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Row insertion timestamp. |

### Indexes

| Index | Columns | Purpose |
|---|---|---|
| `idx_accuracy_provider` | `(provider)` | Filter by provider. |
| `idx_accuracy_target_time` | `(target_time)` | Range queries over time. |
| `idx_accuracy_metric` | `(metric)` | Filter by metric type. |
| `idx_accuracy_provider_metric_target` | `(provider, metric, target_time)` | Composite index for the main MoE aggregation query. |

### RLS Policies

| Policy | Operation | Role | Condition |
|---|---|---|---|
| Service role manages accuracy log | `ALL` | `service_role` | `true` |

No `authenticated` user policies exist — all table access is mediated through API endpoints.

---

## 6. Entity-Relationship Summary

```
auth.users (Supabase built-in)
    │
    │ 1:1 (trigger)
    ▼
public.profiles
    │
    ├── 1:N ──► public.saved_locations
    ├── 1:N ──► public.subscriptions
    └── 1:1 ──► public.user_preferences

public.forecast_accuracy_log   (no FK to profiles; provider-level data)
```

All foreign keys from child tables back to `profiles.id` use `ON DELETE CASCADE`, so deleting a user from `auth.users` will cascade through `profiles` and clean up all related rows automatically.
