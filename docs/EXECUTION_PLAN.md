# MoE Weather — Parallel Agent Execution Plan

> **Status:** Draft v1
> **Owner:** Project lead
> **Scope:** Transition MoE Weather from a single-developer web app to a multi-platform (web + iOS + Android), multi-region (NA + EU), monetizable product.
> **Execution model:** Multiple specialized agents spawned in parallel by wave orchestrators, each agent working in an isolated git worktree.

---

## Wave Structure Overview

```
WAVE 0  →  Foundation (sequential, ~1 day)
            ↓
WAVE 1  →  Parallel Build-Out (3 tracks × 4–5 agents, ~3–5 days)
            ↓
WAVE 2  →  Integration & Premium Features (2 tracks, partial parallel)
            ↓
WAVE 3  →  Flutter App (3 phases, mostly parallel) — can start in parallel with Wave 2
            ↓
WAVE 4  →  Quality, Launch, Beta
```

**Critical rules:**
- Wave 0 must complete and merge before Wave 1.
- After Wave 1 merges, Wave 3 (Flutter) can start in parallel with Wave 2 because they operate on different codebases.
- Within a wave, agents marked "parallel" can run simultaneously; agents marked "sequential" must run one after another because they touch the same hot files.

---

## Coordination Standards (apply to every agent in every wave)

| Standard | Rule |
|---|---|
| **Branching** | Each agent works in isolated worktree. Branch name: `wave{N}/{phase}/{agent-id}-{slug}` (e.g., `wave1/track-a/A1-redis-cache`) |
| **Commits** | Conventional commits (`feat(adapter): add MeteoAlarm`, `fix(cache): handle Redis timeout`). One logical commit per task. |
| **Logging** | Use shared `logger` from `src/lib/logger.ts` (built in Wave 0). No `console.log` allowed after Wave 0 completes. Every operation logs entry + duration + outcome. |
| **Tests** | Every new file ships with a test file. Minimum 70% line coverage on new code. Tests must pass in CI before merge. |
| **Types** | Strict TypeScript. No `any`. Zod schemas required for all external API responses. |
| **Dependencies** | All new npm deps must justify size + license. Lock to specific versions. No transitive bloat. |
| **PR template** | Mission, files touched, test results, log output sample, acceptance criteria checklist (all boxes must be checked). |
| **Code review** | Each PR reviewed by orchestrator before merge. Reviewer verifies acceptance criteria + runs CI. |

---

## WAVE 0 — Foundation (sequential, 4 agents)

This wave establishes the shared infrastructure every other agent depends on. Run **sequentially** because each builds on the prior and they all modify `package.json` and config files.

**Duration estimate:** 1 day
**Parallelism:** None — sequential

### Agent W0-1: Logging Infrastructure

**Mission:** Install `pino` + `pino-pretty`. Create `src/lib/logger.ts` exporting a structured logger with levels (trace/debug/info/warn/error), child logger support, request ID injection middleware for Express, and dev-friendly pretty output in development. Replace all `console.log` calls in existing code.

**Files owned:**
- `src/lib/logger.ts` (new)
- `src/lib/request-id.ts` (new)
- `src/middleware/logging.ts` (new)
- Modifications to: `src/server.ts`, `src/engine/orchestrator.ts`, `src/engine/cache.ts`, all `src/adapters/*.ts`

**Deliverables:**
- README section "Logging conventions"
- Tests: `src/lib/__tests__/logger.test.ts`
- All existing `console.log` calls migrated

**Acceptance:**
- [ ] Every existing request emits a structured log with `requestId`, `method`, `path`, `duration`, `status`, `userAgent`
- [ ] `logger.child({ component: 'adapter:nws' })` works and persists context
- [ ] Dev mode emits human-readable pretty output; prod emits JSON
- [ ] Zero `console.log` calls remain in `src/`
- [ ] Test coverage ≥80% on new logger code

### Agent W0-2: Testing Infrastructure

**Mission:** Configure `vitest` properly. Create test patterns, mock helpers for external API calls (using `msw` for HTTP mocking), fixture data for each weather provider currently in the codebase.

**Files owned:**
- `vitest.config.ts` (new)
- `src/test/fixtures/` (new directory with sample JSON responses)
- `src/test/helpers/mock-adapter.ts` (new)
- `src/test/helpers/msw-server.ts` (new)
- One smoke test per existing adapter

**Deliverables:**
- `npm run test`, `npm run test:coverage`, `npm run test:watch` scripts
- Fixture files for: Open-Meteo, NWS, OpenWeatherMap, WeatherAPI, Bright Sky, MET Norway
- Documentation: how to write tests for new adapters

**Acceptance:**
- [ ] `npm test` runs green
- [ ] Coverage report generates HTML in `coverage/`
- [ ] Each existing adapter has at least one smoke test
- [ ] `msw` intercepts HTTP and serves fixtures during tests
- [ ] CI integration documented (used in W0-4)

### Agent W0-3: Error Tracking + Metrics

**Mission:** Install Sentry SDK (`@sentry/node`). Add error middleware. Create `src/lib/metrics.ts` for counters (cache hits, provider calls, errors per provider, request latency histograms). Expose `/api/metrics` endpoint (Prometheus format, gated by `METRICS_TOKEN` in production).

**Files owned:**
- `src/lib/sentry.ts` (new)
- `src/lib/metrics.ts` (new)
- `src/middleware/error-handler.ts` (new)
- `src/routes/metrics.ts` (new)
- `.env.example` (modified — add Sentry + metrics token)

**Deliverables:**
- Sentry initialized on app start
- Counters: `weather_provider_requests_total{provider,status}`, `weather_cache_hits_total{type}`, `weather_request_duration_seconds{endpoint}`
- Tests for metrics counters

**Acceptance:**
- [ ] Throw a test error → it appears in Sentry
- [ ] `curl /api/metrics -H "Authorization: Bearer $METRICS_TOKEN"` returns Prometheus-format counters
- [ ] Counters increment correctly under load
- [ ] Sentry captures request context (user ID once auth exists, request ID always)

### Agent W0-4: CI Pipeline

**Mission:** GitHub Actions workflow: install, typecheck, lint, test, coverage report. Block PRs that fail any gate.

**Files owned:**
- `.github/workflows/ci.yml` (new)
- `.github/workflows/pr-checks.yml` (new)
- `.github/PULL_REQUEST_TEMPLATE.md` (new)
- `docs/BRANCH_PROTECTION.md` (new — documents required GitHub settings)

**Deliverables:**
- CI runs on all PRs to `main`
- Coverage report posted as PR comment
- Failure on: typecheck error, lint error, test failure, coverage drop below threshold

**Acceptance:**
- [ ] Push a feature branch → CI runs all gates
- [ ] Failing test blocks the merge button
- [ ] Coverage report visible in PR
- [ ] Branch protection rules documented for project lead to enable

---

## WAVE 1 — Parallel Build-Out (three tracks, run simultaneously)

After Wave 0 merges, launch all three tracks in parallel. Each track has multiple agents that can also run in parallel because they work on separate files.

**Duration estimate:** 3–5 days
**Parallelism:** High — up to 13 agents simultaneously

### Track A — Infrastructure (4 parallel agents)

#### Agent A1: Redis Cache Migration

**Mission:** Replace `node-cache` in `src/engine/cache.ts` with Upstash Redis (REST-based, serverless-friendly). Keep the same `CacheManager` public API so no calling code changes. Add cache warming for top-100 cities every 10 minutes via a background job.

**Files owned:**
- `src/engine/cache.ts` (rewritten)
- `src/lib/redis.ts` (new)
- `src/jobs/cache-warmer.ts` (new)
- `src/jobs/index.ts` (new — job scheduler)

**Acceptance:**
- [ ] All existing endpoints work unchanged
- [ ] Cache survives process restart
- [ ] Hit rate tracked in metrics (uses W0-3 counters)
- [ ] Cache warmer runs every 10 minutes and prefetches top 100 cities
- [ ] Test suite includes integration test against local Redis

#### Agent A2: Per-User Rate Limiting

**Mission:** Replace global rate limiter with per-user limits using Redis. Free tier: 100 req/15min. Pro tier: 1000 req/15min. Unauthenticated: 30 req/15min by IP.

**Files owned:**
- `src/middleware/rate-limit.ts` (rewritten)

**Acceptance:**
- [ ] Hammer endpoint as anonymous IP → 429 after 30 requests
- [ ] Hammer as Pro user → no limit hit at 100 requests
- [ ] Rate limit counters expire correctly
- [ ] Headers include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

#### Agent A3: Health & Readiness Endpoints

**Mission:** Split `/api/health` into `/health/live` (process alive, returns 200 always) and `/health/ready` (Redis reachable + at least one provider responsive). Add provider latency tracking exposed via the metrics endpoint.

**Files owned:**
- `src/routes/health.ts` (rewritten)

**Acceptance:**
- [ ] `/health/live` returns 200 immediately on startup
- [ ] `/health/ready` returns 503 if Redis is down
- [ ] `/health/ready` returns 200 with provider status JSON when healthy
- [ ] Provider latencies appear in `/api/metrics`

#### Agent A4: Request Validation Hardening

**Mission:** Audit every endpoint. Ensure zod schemas exist for all inputs. Reject malformed coordinates, length-cap geocoding queries, sanitize/normalize unicode in search inputs.

**Files owned:**
- `src/middleware/validate.ts` (new)
- All `src/routes/*.ts` files (schema additions)

**Acceptance:**
- [ ] Every endpoint has a zod schema
- [ ] Invalid coordinate (lat=999) returns 400 with descriptive error
- [ ] Geocoding query >100 chars rejected
- [ ] Unicode-normalized inputs prevent homograph attacks
- [ ] Schema reuse via shared zod fragments

### Track B — New Adapters (5 parallel agents)

Each agent owns a single new adapter file. Zero overlap.

#### Agent B1: MeteoAlarm Adapter

**Mission:** Build `src/adapters/meteo-alarm.ts` parsing the official EU Atom feeds from `https://feeds.meteoalarm.org/feeds/`. Country routing by reverse geocoding latitude/longitude → ISO country code. Maps MeteoAlarm severity (Minor/Moderate/Severe/Extreme) to your existing alert schema.

**Files owned:**
- `src/adapters/meteo-alarm.ts` (new)
- `src/lib/country-lookup.ts` (new — lat/lon → ISO country code via offline lookup table)

**Acceptance:**
- [ ] Test against Germany, France, Italy, Spain coordinates — returns active alerts with proper severity
- [ ] Handles regions with no active alerts (returns empty array, not error)
- [ ] Adapter implements `getProvider()` returning `'meteo-alarm'`
- [ ] Atom XML parsed safely (no XXE)
- [ ] Cache TTL: 60 seconds (alerts must be fresh)

#### Agent B2: Environment Canada Adapter

**Mission:** Build `src/adapters/eccc-canada.ts` using MSC GeoMet API (`https://api.weather.gc.ca/`). Maps to common weather schema. Includes Canadian CAP alerts.

**Files owned:**
- `src/adapters/eccc-canada.ts` (new)

**Acceptance:**
- [ ] Toronto, Vancouver, Iqaluit return current + forecast + alerts
- [ ] Coverage area check `isInCoverageArea(lat, lon)` returns true only for Canada bbox
- [ ] French-language alert text supported (Quebec)
- [ ] Properly handles polar regions (Iqaluit at 63°N)

#### Agent B3: Tomorrow.io Adapter (premium tier)

**Mission:** Build `src/adapters/tomorrow-io.ts` with a special method `getNowcast(lat, lon)` returning 1-minute precip forecast for next 60 min. Mark this output with tier-gated metadata so the API can refuse to serve it to free users.

**Files owned:**
- `src/adapters/tomorrow-io.ts` (new)

**Acceptance:**
- [ ] Returns minute-by-minute precip forecast for 60 min
- [ ] Adapter exposes both standard `fetch()` and `getNowcast()` methods
- [ ] Daily quota (500 calls/day free tier) tracked and respected
- [ ] Output marked `{ tier: 'pro' }` in metadata

#### Agent B4: Pirate Weather Adapter

**Mission:** Build `src/adapters/pirate-weather.ts`. DarkSky-compatible response format. Free tier: 10K calls/month.

**Files owned:**
- `src/adapters/pirate-weather.ts` (new)

**Acceptance:**
- [ ] US/Canada coordinates return forecasts
- [ ] DarkSky response shape correctly mapped to common schema
- [ ] Minutely precipitation supported

#### Agent B5: NOAA CO-OPS Tides Adapter

**Mission:** Build `src/adapters/noaa-tides.ts` replacing the lunar-estimation tide code in `server.ts`. Look up nearest tide station from NOAA CO-OPS API and pull real predictions. US/PR/VI only — gracefully fall back to lunar estimate elsewhere.

**Files owned:**
- `src/adapters/noaa-tides.ts` (new)
- Modifications to `/api/marine` endpoint in `src/server.ts` (tide section only)

**Acceptance:**
- [ ] Boston, San Francisco, Miami return real tide times
- [ ] Inland points (Denver) return lunar estimate without erroring
- [ ] Nearest station lookup cached for 24h
- [ ] Tide predictions include both high and low tides for next 48h

### Track C — User System (4 parallel agents)

#### Agent C1: Supabase Auth Integration

**Mission:** Add `@supabase/supabase-js`. Email + Google OAuth. JWT middleware that decorates `req.user` (id, tier, email) on authenticated requests.

**Files owned:**
- `src/lib/supabase.ts` (new)
- `src/middleware/auth.ts` (new)
- `src/routes/auth.ts` (new)

**Acceptance:**
- [ ] Sign up → email confirmation flow works
- [ ] Google OAuth flow works
- [ ] JWT validated on every authenticated request
- [ ] Anonymous endpoints still work without auth (graceful)

#### Agent C2: Database Schema

**Mission:** Supabase migrations for `users` (extends `auth.users`), `saved_locations`, `user_preferences`, `subscriptions`, `forecast_accuracy_log` (Wave 2 dependency, schema ready now).

**Files owned:**
- `supabase/migrations/*.sql`
- `supabase/seed.sql`
- `docs/SCHEMA.md`

**Acceptance:**
- [ ] All migrations apply cleanly on fresh DB
- [ ] Row-level security policies enforce user data isolation
- [ ] Indices on common query paths (user_id, location)
- [ ] Schema documented

#### Agent C3: Saved Locations API

**Mission:** REST CRUD `/api/locations` for saved locations. Free tier: max 1 saved location. Pro tier: unlimited.

**Files owned:**
- `src/routes/locations.ts` (new)

**Acceptance:**
- [ ] `POST /api/locations` creates a saved location
- [ ] Free tier returns 402 on second location
- [ ] Pro tier accepts unlimited
- [ ] `DELETE /api/locations/:id` works
- [ ] User can only see their own locations (RLS verified)

#### Agent C4: Subscription/Tier Logic

**Mission:** Webhook receiver for RevenueCat. Updates `subscriptions` row. Helper `getUserTier(userId)` cached in Redis with 1-minute TTL.

**Files owned:**
- `src/routes/webhooks/revenuecat.ts` (new)
- `src/lib/tier.ts` (new)

**Acceptance:**
- [ ] RevenueCat webhook signature verified
- [ ] Subscription state syncs (active, expired, canceled, in_grace)
- [ ] `getUserTier()` returns `'free'` or `'pro'`
- [ ] Cache invalidated on webhook update

---

## WAVE 2 — Integration & Premium Features

Two tracks. Track D touches hot files (`orchestrator.ts`, `consensus.ts`) so its agents run sequentially. Track E runs in parallel after D ships.

**Duration estimate:** 2–3 days
**Parallelism:** Mixed

### Track D — Routing & Consensus (sequential, 4 agents)

#### Agent D1: Regional Routing Expansion

**Mission:** Add `isEULocation()`, `isUKLocation()`, `isCanadaLocation()` helpers to `orchestrator.ts`. Wire in MeteoAlarm and ECCC adapters from Wave 1. Update `selectProviders()` logic to include new regional sources.

**Files modified:** `src/engine/orchestrator.ts`

**Acceptance:**
- [ ] EU location query includes MeteoAlarm
- [ ] Canadian location query includes ECCC
- [ ] Existing US/Germany/Nordic routing unchanged
- [ ] All new regional checks unit-tested with edge cases

#### Agent D2: Consensus Weights for New Providers

**Mission:** Add base weights for Tomorrow.io, Pirate Weather, ECCC, MeteoAlarm in `consensus.ts`. Tomorrow.io gets premium weight on nowcast metrics only. ECCC gets premium weight in Canada.

**Files modified:** `src/engine/consensus.ts`

**Acceptance:**
- [ ] Weight tables updated with documentation comments justifying values
- [ ] Tomorrow.io nowcast weight ≥0.40 for precip-next-60min metric
- [ ] ECCC weight ≥0.30 for Canadian coordinates
- [ ] Tests verify weights sum correctly

#### Agent D3: Geocoding Locale Passthrough

**Mission:** Fix the `language: 'en'` hardcode in `orchestrator.ts:514`. Accept `lang` query param on `/api/geocode`, default from `Accept-Language` header.

**Files modified:** `src/engine/orchestrator.ts`, `src/routes/geocode.ts`

**Acceptance:**
- [ ] German user searching "Köln" gets "Köln" not "Cologne"
- [ ] Defaults to `en` if no header
- [ ] Supports all Open-Meteo geocoding languages

#### Agent D4: Unit Locale Mapping

**Mission:** Add `unit_locale` system (e.g., `en-GB` for UK = °C + mph + hPa). Map all unit conversions through it.

**Files owned:**
- `src/lib/units.ts` (new)
- Modifications to weather response formatting

**Acceptance:**
- [ ] UK user gets °C + mph + hPa
- [ ] US user gets °F + mph + inHg
- [ ] Continental EU gets °C + km/h + hPa
- [ ] Canada gets °C + km/h + kPa
- [ ] User preference overrides locale default

### Track E — Premium Features (4 parallel agents, after D ships)

#### Agent E1: Nowcasting Endpoint

**Mission:** `/api/nowcast?lat=&lon=` — Pro tier only, returns Tomorrow.io minute-by-minute precip. Returns 402 Payment Required for free tier.

**Files owned:**
- `src/routes/nowcast.ts` (new)

**Acceptance:**
- [ ] Pro user gets minute-by-minute data
- [ ] Free user gets 402 with upgrade prompt
- [ ] Cached for 5 minutes per coordinate
- [ ] Tier check uses `getUserTier()` from C4

#### Agent E2: Push Notification System

**Mission:** Web Push (VAPID) for PWA, FCM for Flutter. User subscribes via `/api/notifications/subscribe`. Background job checks alerts every 5 minutes and pushes to subscribed users.

**Files owned:**
- `src/routes/notifications.ts` (new)
- `src/jobs/alert-pusher.ts` (new)
- `src/lib/push.ts` (new)

**Acceptance:**
- [ ] User can subscribe and receive a test push
- [ ] Alert job fires for severe weather only (severity >= moderate)
- [ ] Deduped (user doesn't get same alert twice)
- [ ] User can unsubscribe

#### Agent E3: Forecast Accuracy Tracking

**Mission:** Cron job stores each forecast prediction. 24h later, fetches actual observation, computes error per provider. Pipes to `forecast_accuracy_log` table. Feedback loop adjusts `consensus.ts` weights.

**Files owned:**
- `src/jobs/accuracy-tracker.ts` (new)
- `src/lib/accuracy.ts` (new)
- `supabase/migrations/{date}_accuracy_log.sql` (extends C2 schema)

**Acceptance:**
- [ ] Forecasts stored at creation
- [ ] Actuals fetched at T+24h, error computed
- [ ] MAE per provider visible in metrics
- [ ] Weight adjustment runs weekly and is reversible

#### Agent E4: Elevation Correction

**Mission:** Use Open-Meteo elevation API for queried coordinate vs nearest weather station. Apply `−6.5°C/1000m` lapse rate correction. Significant in mountains.

**Files owned:**
- `src/lib/elevation.ts` (new)
- Modifications to `consensus.ts` to apply correction post-aggregation

**Acceptance:**
- [ ] Mountain coordinate (Aspen, CO) gets corrected temperature
- [ ] Elevation cached per coordinate for 30 days
- [ ] Correction only applied when station elevation differs by >100m
- [ ] Documented with sample before/after comparisons

---

## WAVE 3 — Flutter App (parallel to Wave 2)

Operates on `flutter_app/` subdirectory. Independent of backend changes. Backend API contract from Wave 1 is the only dependency.

**Duration estimate:** 5–7 days
**Parallelism:** Very high — 13 agents across 3 phases

### Phase G — Foundation (4 parallel agents)

#### Agent G1: Project Scaffolding

**Mission:** Flutter project with Riverpod, Dio, Hive, freezed, build_runner. Folder structure: `lib/features/`, `lib/core/`, `lib/api/`. iOS + Android build configurations.

**Files owned:** `flutter_app/` (new)

**Acceptance:**
- [ ] `flutter run` works on iOS simulator + Android emulator
- [ ] Lint passes (`flutter analyze`)
- [ ] Initial test passes (`flutter test`)
- [ ] Folder structure documented

#### Agent G2: API Client

**Mission:** Generated Dio client matching backend endpoints. Auto-retry, request ID injection, auth header injection, response caching.

**Files owned:** `flutter_app/lib/api/`

**Acceptance:**
- [ ] All Wave 1 backend endpoints have typed client methods
- [ ] Retry on network failure with backoff
- [ ] Auth token attached when user authenticated
- [ ] Tests against mock backend pass

#### Agent G3: Auth + RevenueCat

**Mission:** Sign-in screens, RevenueCat SDK, paywall component. Supabase Flutter SDK for auth.

**Files owned:** `flutter_app/lib/features/auth/`

**Acceptance:**
- [ ] Email signup + Google OAuth work on both platforms
- [ ] RevenueCat initialized with App Store + Play Store products
- [ ] Paywall renders with monthly + annual options
- [ ] Tier state reflected globally via Riverpod

#### Agent G4: AdMob Integration

**Mission:** Banner + interstitial for free tier. Conditional rendering by tier. iOS + Android app IDs configured.

**Files owned:** `flutter_app/lib/features/ads/`

**Acceptance:**
- [ ] Banner shows on home screen for free users
- [ ] No ads for Pro users
- [ ] Interstitial after every 5th forecast view
- [ ] Test ad IDs in dev, production IDs gated behind env

### Phase H — Feature Screens (5 parallel agents)

#### Agent H1: Current + Hourly + Daily

**Mission:** Hero card with current weather. Hourly horizontal scroll. Daily list. FL Chart for temperature curve.

**Files owned:** `flutter_app/lib/features/forecast/`

**Acceptance:**
- [ ] Matches the visual quality of current web app
- [ ] Pull-to-refresh works
- [ ] Animated temperature transitions
- [ ] Charts adapt to dark mode

#### Agent H2: Air Quality, Marine, Astronomy

**Mission:** Three tabbed screens matching existing web functionality.

**Files owned:** `flutter_app/lib/features/specialty/`

**Acceptance:**
- [ ] AQI gauge animated, color-coded
- [ ] Marine conditions show waves + tide times
- [ ] Astronomy shows sun/moon/zodiac with proper icons

#### Agent H3: Settings + Saved Locations

**Mission:** Location manager, unit preferences, tier-aware UI (lock icons on premium features).

**Files owned:** `flutter_app/lib/features/settings/`, `flutter_app/lib/features/locations/`

**Acceptance:**
- [ ] Free user can save 1 location, second attempt shows paywall
- [ ] Pro user can save unlimited
- [ ] Unit preferences persisted via Hive
- [ ] Premium features visibly locked for free users

#### Agent H4: Home Screen Widgets

**Mission:** iOS WidgetKit + Android Glance widgets. Current temp, condition, today's high/low.

**Files owned:** `flutter_app/ios/Widget/`, `flutter_app/android/app/src/main/.../widgets/`

**Acceptance:**
- [ ] Small + medium widget sizes for both platforms
- [ ] Updates every 30 minutes via background refresh
- [ ] Tap opens app to selected location
- [ ] Pro-tier only

#### Agent H5: Push Notifications + Severe Weather

**Mission:** FCM integration. Local notifications for nowcast ("Rain in 8 minutes"). Severe weather alerts.

**Files owned:** `flutter_app/lib/features/notifications/`

**Acceptance:**
- [ ] User can opt in during onboarding
- [ ] Test push delivered within 5 seconds
- [ ] Notification taps deep-link to relevant screen
- [ ] iOS critical alerts entitlement requested for severe weather

### Phase I — Polish (4 parallel agents)

#### Agent I1: Animations

**Mission:** Lottie weather animations (rain, snow, sun, clouds). Page transitions. Pull-to-refresh custom animation.

**Files owned:** `flutter_app/lib/core/animations/`, `flutter_app/assets/lottie/`

**Acceptance:**
- [ ] Each weather condition has a matching animation
- [ ] Performance: 60fps on mid-tier devices
- [ ] Reduced-motion accessibility setting respected

#### Agent I2: Theming + Accessibility

**Mission:** Dark mode, system theme follow, screen reader labels, font scaling, color contrast verified.

**Files owned:** `flutter_app/lib/core/theme/`

**Acceptance:**
- [ ] Light + dark themes match brand
- [ ] WCAG AA contrast on all text
- [ ] Screen reader announces every interactive element
- [ ] Font scaling 200% doesn't break layout

#### Agent I3: Onboarding Flow

**Mission:** Location permission, notification opt-in, tier selection, initial location setup.

**Files owned:** `flutter_app/lib/features/onboarding/`

**Acceptance:**
- [ ] 4 screens maximum
- [ ] Permission denials handled gracefully (manual location entry)
- [ ] Skippable but trackable in analytics

#### Agent I4: Store Assets

**Mission:** Screenshots (all device sizes), App Store description, privacy policy, Play Store listing copy.

**Files owned:** `marketing/`

**Acceptance:**
- [ ] iPhone 6.5" + 5.5" + iPad screenshots
- [ ] Android phone + 7" tablet + 10" tablet screenshots
- [ ] Privacy policy covers all data collection
- [ ] App description optimized for ASO keywords

---

## WAVE 4 — Quality & Launch (4 agents, mostly parallel)

**Duration estimate:** 2–3 days
**Parallelism:** High

| Agent | Mission | Acceptance |
|---|---|---|
| **W4-1** | E2E test suite (Playwright for web, Patrol for Flutter). Critical user paths covered. | All P0 user flows pass on every commit |
| **W4-2** | Load testing with k6. Target: 1000 req/s sustained on cache-hit path, 100 req/s on cache-miss. | Sustained target hit without errors |
| **W4-3** | Security audit. Run `/security-review`. Dependency audit. Secret scanning. OWASP checks. | Zero critical or high findings |
| **W4-4** | Beta program. TestFlight + Play Internal. Feedback collection via Sentry user feedback. | 20+ beta users active, feedback triaged |

---

## Quality Gates Between Waves

```
Wave 0 → 1:  All tests green, logger emits structured JSON, CI green, Sentry receiving events
Wave 1 → 2:  Each track's PRs merged independently, Redis live, 5 new adapters callable, Supabase auth working
Wave 2 → 3:  Premium features behind tier gate, accuracy tracking running, MeteoAlarm + ECCC routed correctly
Wave 3 → 4:  Flutter builds for iOS + Android, paywall functional, ads render, push notifications work
Wave 4 → Prod: Load test passed, security clean, beta feedback addressed
```

---

## Orchestrator Briefing Template

When spinning up a wave orchestrator agent, hand it this:

```
You are the Wave {N} orchestrator. Your job is to spawn the agents listed
in /docs/EXECUTION_PLAN.md (Wave {N} section) in parallel using the Agent tool
with isolation: "worktree".

For each parallel-eligible agent:
1. Spawn with subagent_type "general-purpose"
2. Pass the agent's full briefing from the plan (mission, files owned,
   deliverables, acceptance criteria)
3. Set run_in_background: true so all agents work simultaneously
4. When agents return, verify their worktree branches exist and tests pass
5. Run CI on each branch
6. Merge in dependency order
7. Report back: which agents succeeded, which failed, what merged, what remains

You must NOT do the engineering work yourself. You are a router, reviewer,
and integrator.

Before merging any agent's branch:
- Verify acceptance criteria checklist is complete
- Verify CI passes
- Verify test coverage threshold (70% on new code)
- Verify no console.log calls introduced (post-Wave-0)
- Verify logger.child used with correct component name

If an agent fails a gate, do NOT auto-retry. Report back with the failure
mode so the project lead can decide.
```

---

## Agent Briefing Template (for individual task agents)

```
You are agent {AGENT_ID}, working on {WAVE}/{TRACK}/{PHASE}.

MISSION: {one paragraph from plan}

FILES YOU OWN: {file list — these and only these are yours to create/modify}

DELIVERABLES: {bullet list}

ACCEPTANCE CRITERIA: {checklist — every box must be checked before you return}

COORDINATION STANDARDS (REQUIRED):
- Branch: {wave/phase/agent-id-slug}
- Use logger from src/lib/logger.ts. No console.log.
- Tests in src/{component}/__tests__/. Min 70% coverage.
- Strict TypeScript. Zod schemas for external data.
- Conventional commit messages.

WHEN COMPLETE:
- Commit your work with a conventional commit message
- Run npm test and npm run typecheck — both must pass
- Return a summary with: files changed, test results, acceptance checklist state

WHEN BLOCKED:
- Do not improvise outside your files-owned list
- Return immediately with a clear description of the blocker
- The orchestrator will resolve cross-agent dependencies

Working directory is an isolated worktree of C:\MoE-Weather. Your changes
won't affect main until the orchestrator merges your branch.
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Two agents touch same file (merge conflict) | Medium | Low | File ownership enforced; orchestrator merges sequentially in dependency order |
| Wave 1 adapter breaks consensus | Medium | High | Wave 2 D1/D2 explicitly test new providers in consensus; staging environment required |
| Tomorrow.io quota exhausted | Low | Medium | Free tier 500/day enforced via quota tracking; auto-fallback to Open-Meteo |
| Supabase RLS misconfigured (data leak) | Low | Critical | W4-3 security audit; manual RLS review required pre-launch |
| Flutter app store rejection | Medium | Medium | I4 ensures store assets correct; W4-4 beta surfaces issues |
| Revenue insufficient for Open-Meteo commercial | Low | Medium | Stay on free tier until $99/mo revenue; commercial license only required for true commercial use |

---

## Open Questions for Project Lead

1. Which database hosting? (Recommended: Supabase managed)
2. Which Redis hosting? (Recommended: Upstash for serverless-friendly REST API)
3. Domain + DNS strategy for the app?
4. Apple Developer + Google Play developer accounts already enrolled?
5. RevenueCat account created and products configured?
6. Sentry org + project created?
7. Analytics: PostHog, Mixpanel, or none for v1?

---

## What to Do Next

1. **Today:** Project lead reviews this plan, answers open questions, decides start date
2. **Day 1:** Spin up Wave 0 orchestrator. Sequential execution. ~1 day.
3. **Day 2:** Wave 0 reviewed and merged. Spin up Wave 1 orchestrator with 3 tracks.
4. **Day 5–7:** Wave 1 complete. Spin up Wave 2 orchestrator + Wave 3 orchestrator in parallel.
5. **Day 10–14:** Wave 4. Launch.

This plan is a living document. Update it as agents complete work and as new requirements emerge.
