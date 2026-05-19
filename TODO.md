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

- [x] **`app/admin/(protected)/analytics/page.tsx`** — added `getAnalyticsData(gymId)`
  wrapper to `lib/domain/analytics.ts`. Fetches timezone once then fires all
  three chart functions in parallel. Inline timezone query removed from page.

- [x] **`app/admin/(protected)/layout.tsx`** — extracted to `lib/domain/admin.ts`
  → `getAdminLayoutData(userId, activeGymId)`. Also fixed a bug: the original
  query filtered only by `userId`, so multi-gym admins could see the wrong gym
  name in the navbar after switching gyms. Now filters by both `activeGymId`
  and `userId`, so the cookie is validated and the correct name is always shown.

- [x] **`app/admin/select-gym/page.tsx`** — extracted to `lib/domain/admin.ts`
  → `getAssignedGyms(userId)`. Single JOIN query moved to domain.

---

## Broader architectural debt

### MEDIUM

- [x] **Timezone SQL fragment duplicated 10+ times** — extracted to `lib/db/time.ts`
  with helpers `monthStart(tz)`, `monthStartDate(tz)`, and `dayStart(tz)`.
  Replaced 16 occurrences across 6 files (`credits.ts`, `fichaje.ts`, `dashboard.ts`,
  `member.ts`, `member-detail.ts`, `members-list.ts`). One place to fix a timezone bug.

- [x] **User creation has no transaction boundary** — extracted to
  `lib/domain/users.ts` → `createGymAdmin({...})`. The two DB inserts
  (`profiles` + `gymAdmins`) now run inside `db.transaction()`; on failure,
  the catch block calls `adminClient.auth.admin.deleteUser(userId)` to remove
  the orphaned auth user before returning the error.

- [x] **Auth checks duplicated across 3 layers** — centralized into
  `lib/auth/context.ts` with `requireGymAdmin()` (returns `{ user, gymId }` or
  null; also verifies DB assignment) and `requireSuperAdmin()` (returns
  `{ user }` or null). Replaced 5 copy-pasted `getAuthContext()` functions
  in `payments`, `settings`, `plans`, `members`, `check-in` actions, and 2
  inline superadmin checks. `proxy.ts` (different Supabase client),
  `layout.tsx` (redirects), and `select-gym/actions.ts` (sets the cookie)
  are intentionally left as-is.

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

- [x] **Fichaje domain unit tests** — `tests/unit/fichaje.test.ts`. Covers
  `validateFichaje` (empty query, not_found, multiple_matches) and
  `validateMemberFichaje` (already_today, no enrollment, unlimited plan,
  credits > 0, over_limit allowed/denied, missing gymSettings row).
  DB mocked via `tests/helpers/db-mock.ts`; `getAvailableCredits` mocked
  separately so fichaje business logic is tested in isolation.

- [x] **Credit calculation unit tests** — `tests/unit/credits.test.ts`. Covers
  `getAvailableCredits()`: no enrollment → null, unlimited plan → Infinity,
  full credits, partial credits, depleted (0), negative balance, positive and
  negative adjustments. Drizzle aggregate queries (no `.limit()`) handled by
  the shared `makeSelectChain` helper.

- [x] **Enrollment action integration test** — `tests/unit/enrollment.test.ts`.
  Confirms `enrollMemberAction` deactivates the old enrollment (`active: 'false'`)
  before inserting the new one (verified via `invocationCallOrder`), inserts with
  correct `gymId`/`memberId`/`planId`/`active: 'true'`, and returns `{ error }`
  for missing auth, unknown member, unknown plan, and missing form fields.
  `requireGymAdmin` and `revalidatePath` mocked so the action runs in plain Node.

### MEDIUM — add before public / beta launch

- [x] **Payment action integration tests** — `tests/unit/payments.test.ts`.
  Covers `registerPaymentAction` (auth, validation, `pesosTocentavos` conversion,
  correct `periodStart`/`periodEnd` for a given YYYY-MM, `paidAt` set for paid
  and null for pending), `markOverdueAction` (auth, sets `status: 'overdue'`),
  and `updatePaymentStatusAction` (auth, invalid data guard, `paidAt` logic for
  all three statuses). Note: SQL filter correctness (`periodEnd < now()`) is a
  real-DB concern — see MEDIUM backlog item if integration tests are added later.

- [x] **Proxy route protection tests** — `tests/unit/proxy.test.ts`. `proxy.ts`
  is a plain function so Playwright was not needed. Covers: rate-limit exceeded
  on `/g/*` → 429; rate-limit ok → pass-through; `/_next/*` → pass-through;
  no session + protected route → redirect `/login`; session on `/login` →
  redirected to role home (gym_admin, superadmin, member); gym_admin on
  `/superadmin/*` → redirect; member on `/admin/*` → redirect; gym_admin on
  `/admin/*` without `ACTIVE_GYM_COOKIE` → redirect to `/admin/select-gym`;
  gym_admin with cookie → pass-through. `@supabase/ssr` and Upstash mocked via
  `vi.hoisted`.

- [x] **Public kiosk action tests** — `tests/unit/kiosk.test.ts`. Covers
  `publicFichajeAction`: empty document → not_found without DB call; unknown
  slug → invalid_gym; correct gym found → validates via `validateFichaje`;
  `ok` → `recordVisit` called with `overLimit=false`; `over_limit_allowed` →
  `recordVisit` called with `overLimit=true`; all non-recording statuses
  (`already_today`, `not_found`, `over_limit_denied`, `no_active_enrollment`)
  → `recordVisit` not called. Full browser E2E (success screen / error UI) still
  pending — requires Playwright + running server (see LOW backlog).

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
