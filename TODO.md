# Tech Debt

Architectural improvements tracked here. Add new items as they surface;
mark done by moving completed items to the bottom.

Convention reference: CONVENTIONS.md

---

## Pages violating "pages are renderers" rule

These pages run complex queries inline instead of delegating to a domain
function. See CONVENTIONS.md for the correct pattern.

### HIGH — complex enough to cause real friction

- [x] **`app/admin/(protected)/members/[id]/page.tsx`** — extracted to
  `lib/domain/member-detail.ts` → `getMemberDetail(memberId, gymId)`. Reduced
  from 5 round trips to 2. Fixed a bug where `usedCreditsThisMonth` was
  computed client-side in UTC instead of via SQL with gym timezone.

- [x] **`app/admin/(protected)/members/page.tsx`** — extracted to
  `lib/domain/members-list.ts` → `getMembersList(gymId, filters)`. Reduced
  from 4 round trips to 2 by running gym, count, and member rows in parallel.
  Filter building and map assembly moved out of the page.

### MEDIUM — one or two complex queries that should move out

- [x] **`app/admin/(protected)/dashboard/page.tsx`** — added `getDashboardContext(gymId)`
  to `lib/domain/dashboard.ts` that JOINs gyms + gymSettings in one query.
  Inline gym + settings fetch removed; page reduced to 2 round trips.

- [x] **`app/admin/(protected)/payments/page.tsx`** — extracted to
  `lib/domain/payments.ts` → `getPaymentsPageData(gymId, filters)`. Both
  complex queries (payments JOIN members + members LEFT JOIN enrollments/plans)
  run in parallel inside the domain function. `pendingOverdue` computation moved
  to domain. Filter validation (status enum, month regex) moved to domain.

- [x] **`app/superadmin/admins/page.tsx`** — extracted to
  `lib/domain/superadmin.ts` → `getAdminsPageData()`. Both parallel queries
  (all gyms + profiles LEFT JOIN gymAdmins LEFT JOIN gyms) now in domain.

- [x] **`app/superadmin/gyms/page.tsx`** — extracted to
  `lib/domain/superadmin.ts` → `getGymsPageData()`. Aggregation query
  (gyms LEFT JOIN gymAdmins GROUP BY) now in domain; adminCount returned
  as typed `number`.

### LOW — single query or simple enough to defer

- [ ] **`app/admin/(protected)/analytics/page.tsx`** — already delegates to
  three domain functions but fetches `gyms.timezone` inline first. Move that
  fetch inside each domain function (they already accept `gymTimezone` as a
  param — caller should not need to pre-fetch it).

- [ ] **`app/admin/(protected)/layout.tsx`** — 2 parallel JOIN queries inline
  (active gym lookup, all assigned gyms). This is a layout, not a page, but
  the same rule applies. Extract to `lib/domain/admin.ts` →
  `getAdminLayoutData(userId, activeGymId)`.

- [ ] **`app/admin/select-gym/page.tsx`** — 1 JOIN query inline (gyms +
  gymAdmins for this user). Extract to `lib/domain/admin.ts` →
  `getAssignedGyms(userId)`.

---

## Broader architectural debt

### MEDIUM

- [ ] **Timezone SQL fragment duplicated 10+ times** — the expression
  `date_trunc('month', now() AT TIME ZONE ${gymTimezone}) AT TIME ZONE ${gymTimezone}`
  is copy-pasted across `lib/domain/credits.ts`, `fichaje.ts`, `dashboard.ts`,
  `analytics.ts`, and multiple pages. Extract to `lib/db/time.ts` with helpers
  `monthStart(tz)` and `dayStart(tz)`. One place to fix a timezone bug.

- [ ] **User creation has no transaction boundary** —
  `app/superadmin/admins/actions.ts` calls Supabase Auth API then inserts into
  `profiles` and `gymAdmins` sequentially with no compensation. If the
  `gymAdmins` insert fails, an orphaned auth user is left behind. Extract to
  `lib/domain/users.ts` → `createGymAdmin({...})` with explicit rollback of
  the auth user on DB failure.

- [ ] **Auth checks duplicated across 3 layers** — `proxy.ts` (middleware),
  `app/admin/(protected)/layout.tsx` (layout guard), and individual actions
  each independently call `supabase.auth.getUser()` and check
  `app_metadata.role`. Centralizing into `lib/auth/context.ts` with typed
  helpers (`requireGymAdmin()`, `requireSuperAdmin()`) would eliminate
  boilerplate and give typed session context to callers.

### LOW

- [ ] **`active` and `overLimit` columns stored as text `'true'/'false'`** —
  should be SQL `BOOLEAN`. Every query that filters on these columns uses
  string comparisons (`eq(members.active, 'true')`), leaking the storage
  representation into every call site. Requires a DB migration + schema update
  + find-and-replace across all queries.

- [ ] **Missing RLS policy for `credit_adjustments` table** — noted since
  Franja 2, still pending. Supabase RLS for this table needs to be defined
  so gym admins can only see their own gym's adjustments.

---

## Testing — production confidence

Goal: a CI run that would catch the classes of bugs that have already surfaced
(UTC timezone miscount, `as unknown as` type coercions, silent partial failures
in multi-step writes). Use **Vitest** for unit/integration, **Playwright** for E2E.

### HIGH — must have before first production deploy

- [ ] **Fichaje domain unit tests** — `lib/domain/fichaje.ts` is the most
  critical path: member search, credit check with timezone-aware month boundary,
  over-limit logic, and `recordVisit` atomicity. Key cases: member not found,
  inactive member, no enrollment, credits at 0 with over-limit enabled, credits
  at 0 with over-limit disabled, exact month boundary in gym timezone (not UTC).

- [ ] **Credit calculation unit tests** — `lib/domain/credits.ts`
  `getAvailableCredits()`. Key cases: unlimited plan → null, credits depleted →
  0 or negative, positive adjustments roll up correctly, month boundary respected
  in gym timezone (not UTC). These directly guard against the UTC bug fixed in
  `member-detail.ts`.

- [ ] **Enrollment action integration test** — `enrollMemberAction` in
  `app/admin/(protected)/plans/actions.ts`. Confirm that re-enrolling a member
  (plan change) deactivates the old enrollment before inserting the new one, and
  that credits reset to the new plan's `creditsPerMonth`.

### MEDIUM — add before public / beta launch

- [ ] **Payment action integration tests** — `registerPaymentAction`,
  `markOverdueAction`, `updatePaymentStatusAction`. Test that a `paid` record
  with `periodStart ≤ now() ≤ periodEnd` is reflected in `getMembersList`'s
  `hasPaid` field; and that `markOverdueAction` only touches records past their
  `periodEnd`.

- [ ] **Proxy route protection tests** — `proxy.ts`. Confirm that
  unauthenticated requests redirect to `/login`, that a gym-admin role cannot
  reach `/superadmin/*`, and that a missing `ACTIVE_GYM_COOKIE` redirects to
  `/admin/select-gym`. Use Playwright's request interception or Next.js test
  utilities.

- [ ] **Public kiosk E2E (Playwright)** — `/g/[slug]`: valid document number →
  success screen. Invalid document → error. Same document twice within the rate-
  limit window → second request is rate-limited or correctly blocked by visit
  cooldown logic.

### LOW — confidence builders, add as capacity allows

- [ ] **Admin golden path E2E** — create member → enroll in plan → record
  payment → check in via admin fichaje panel → verify credit count decrements in
  the member detail page.

- [ ] **Member portal smoke test** — log in as a member, verify portal shows
  correct plan name, credits remaining, and last payment status.

---

## Logging & observability

Goal: when a user reports "my payment didn't save" or "it said I had no credits,"
you should be able to find the exact server action call, its outcome, and the
relevant DB state in under 5 minutes.

### HIGH — production pre-requisite

- [ ] **Error tracking: Sentry** — Install `@sentry/nextjs`. Wire up
  `instrumentation.ts` and `sentry.client.config.ts`. Server actions currently
  return `{ error: string }` but swallow the original `Error` object — Sentry
  should capture the original before conversion. Add `SENTRY_DSN` to env.
  Required before any real user traffic.

- [ ] **Structured logger (`lib/logger.ts`)** — A thin wrapper:
  `logger.info(event, ctx)`, `logger.warn(...)`, `logger.error(err, ctx)`. In
  development: human-readable `console.log`. In production: JSON lines for
  Vercel log drain or Axiom. Shape: `{ level, event, gymId?, memberId?,
  durationMs?, ...ctx }`. Keep it dependency-free or use `pino`.

- [ ] **Instrument the fichaje flow** — Every check-in attempt emits a
  structured log: `{ event: 'fichaje.attempt', gymId, memberId, channel,
  outcome: 'allowed'|'over_limit'|'not_found'|'inactive', creditsRemaining }`.
  This is the single flow users will call about — it must be queryable.

### MEDIUM

- [ ] **Log server action outcomes** — Wrap each action with a thin logger call:
  action name, `gymId` from cookie, outcome (`success` | `error`), duration in
  ms. Do not log form values or PII. Enables correlating a user complaint ("my
  payment didn't save at 3pm") to a specific action call in Vercel logs.

- [ ] **Rate limit hit logging** — `proxy.ts` already enforces Upstash rate
  limiting on `/g/*`. Log hits: `{ event: 'rate_limit.hit', ip, path, gymSlug
  }`. Detects a misconfigured kiosk looping requests before it becomes a support
  ticket.

- [ ] **Slow query alerting** — Wrap domain functions with a timing helper: if a
  call exceeds 800 ms, emit `{ event: 'slow_query', fn, durationMs, gymId }`.
  Analytics and dashboard domain functions are the most likely candidates.

### LOW

- [ ] **Uptime check: `/api/healthz`** — A route that runs `SELECT 1` against
  the DB and returns `{ ok: true }`. Wire to Better Uptime or Vercel's built-in
  monitoring so you learn about downtime before users do.

- [ ] **Log retention decision** — Vercel default is 1 day on Hobby. For a
  production gym app, 30 days minimum is needed to debug user-reported issues
  retrospectively. Decide and document (Pro plan log drain to Axiom is the
  simplest path).

---

## Done

- [x] **`app/portal/account/page.tsx`** — extracted to `lib/domain/member.ts`
  → `getMemberPortalData(userId)`. Reduced from 5 sequential round trips to
  2, fixed a latent bug in `formatDate` for timestamp-typed period fields.
