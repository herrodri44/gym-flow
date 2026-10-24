# GymDex — Plan

The single planning document for gym-flow (product name: GymDex). It holds
how the system works today, the work in progress in priority order, and the
backlog. It replaces `IMPLEMENTATION_PLAN.md` and `TODO.md`; their history
is in git.

Keep it current: when a task ships, delete it from here (git keeps the
record). When a decision changes, update the Decisions section first.
Code conventions live in `CONVENTIONS.md`, testing in `TESTING.md`,
observability in `DEBUGGING.md`.

---

## 1. Current architecture

**Stack:** Next.js 16.2 (App Router, `proxy.ts` instead of `middleware.ts`) ·
React 19.2 · Supabase (Postgres + Auth) · Drizzle ORM 0.45 (`postgres-js`) ·
shadcn v4 on Base UI + daisyUI 5 · Tailwind 4 · Recharts · Upstash rate
limiting · Sentry · Vitest · Vercel.

**Language:** code in English; user-facing strings in Spanish (Argentina).
Currency ARS, stored as integer centavos (see `CONVENTIONS.md`).

**Production:** one live gym. Superadmin creates gyms and gym admins.

### Layout

```
app/
  (auth)/login/            login + logout actions
  admin/select-gym/        gym picker (sets the active-gym cookie)
  admin/accept-terms/      first-login terms acceptance
  admin/(protected)/       dashboard, members, members/[id], plans,
                           payments, check-in, settings, analytics
  superadmin/              gyms, admins
  portal/account/          member's read-only portal
  g/[slug]/                public QR check-in (DNI only, no login)
  legal/                   privacidad, terminos
  api/cron/                Vercel cron routes (CRON_SECRET bearer)
lib/
  auth/                    roles.ts, context.ts (requireGymAdmin / requireSuperAdmin)
  db/                      schema.ts, client.ts, time.ts (tz SQL helpers), migrations/
  domain/                  all business logic and multi-query reads
  supabase/                server / browser / service-role clients
  logger.ts                structured JSON logger
proxy.ts                   RBAC redirects + rate limit on /g/*
tests/unit/                Vitest, DB mocked via tests/helpers/db-mock.ts
tests/integration/         Vitest against local Supabase Postgres (npm run test:integration)
```

### Auth and tenancy

- The role lives in `user.app_metadata.role` (`superadmin` | `gym_admin` |
  `member`). `profiles.role` duplicates it and is not read.
- `proxy.ts` redirects by role. Gym admins need the `gymdex-active-gym`
  cookie; `requireGymAdmin()` verifies it against `gym_admins` on every
  action.
- **Tenant isolation lives in the app.** Drizzle connects with
  `DATABASE_URL`, which bypasses RLS. Every query must filter by
  `gym_id = ctx.gymId`. RLS only protects the anon key / PostgREST.
- Member portal accounts are created when a member has an email; the
  initial password is the DNI (see Security fixes).

### Data facts that are easy to get wrong

- `active` (members, plans) and `visits.over_limit` are real `boolean`
  columns (migration 0002). Older notes saying text are wrong.
- "Can this member train, how many credits are left" always comes from the
  `member_standing` view (`lib/domain/standing.ts`). Don't recompute it.
- Periods are half-open `[start_date, end_date)` in gym-local dates: the
  last valid day is `end_date - 1`. Use `addDays(endDate, -1)` for display.
- All "today / this month" boundaries are computed in the gym's timezone
  via `lib/db/time.ts`. Never use JS `new Date(y, m, d)` for business dates:
  on Vercel it's UTC.

### Local development (no hosted Supabase)

`npm run dev` reads `.env.development.local` (gitignored) before
`.env.local`, so local dev points at a Supabase stack in Docker and never
touches production. Sentry is blanked locally; Upstash rate limiting still
uses the real service (harmless counters).

```bash
nvm use                   # Node 22 (.nvmrc); supabase-js fails on Node 20
supabase start            # Postgres :54322, Auth :54321, Studio :54323
npm run db:local:reset    # drop + apply lib/db/migrations/*.sql + seed
npm run dev
```

Seed logins: `admin@gymdex.local / admin1234` (gym admin),
`super@gymdex.local / super1234`, `elena@gymdex.local / 30000005` (member).
Kiosk: `/g/gym-demo`. The seed mirrors today's production shape
(calendar-month payment rows, some pending/overdue), so it doubles as the
cutover rehearsal dataset. New migrations must be added to
`lib/db/migrations/` to be picked up by the reset.

To bring up `.env.development.local` on a new machine: run
`supabase status -o env` and copy `API_URL`, `ANON_KEY`,
`SERVICE_ROLE_KEY` and `DB_URL` into it.

### Migrations

`drizzle-kit migrate` fails against Supabase (SSL). Process:
1. Write or generate SQL in `lib/db/migrations/NNNN_name.sql`
   (`npx drizzle-kit generate` needs a TTY for enum changes; hand-write
   those).
2. Run it in the Supabase SQL editor.
3. Update `lib/db/schema.ts` to match.

RLS policies were applied by hand and are not in the repo yet (see Phase 3).

### Environment variables

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (server only), `DATABASE_URL` (transaction
pooler), `DATABASE_URL_DIRECT` (drizzle-kit), `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `SENTRY_DSN`,
`NEXT_PUBLIC_SENTRY_DSN`.

### Supabase free plan keep-alive

The project is on the Supabase free plan, which pauses after about a week of
inactivity (it happened 2026-10-14). `vercel.json` runs
`/api/cron/keep-alive` daily (`SELECT 1`, and the request goes through
`proxy.ts`, which calls Supabase Auth). `/api/cron/*` is public in
`proxy.ts`; each route checks `CRON_SECRET`. The free plan has no
downloadable backups: take a `pg_dump` before any migration.

### One-time setup: create the superadmin

Create the user in Supabase → Authentication, then:
```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "superadmin"}'::jsonb
WHERE email = 'tu-email@ejemplo.com';
```

---

## 2. Decisions

Settled decisions that shape the active work. Change them here first.

### Billing: payment-anchored periods (decided 2026-10-01)

Client request: credits should run from the day a member pays until the same
day next month, not by calendar month. Leftover credits expire, and the
gym needs to know who to ask for renewal.

| # | Topic | Decision |
|---|---|---|
| B1 | Period length | Paying on Oct 5 gives a period valid **through Nov 4** inclusive; renewal is due Nov 5. Stored as `[start_date, end_date)` with `end_date` = Nov 5. |
| B2 | Late renewal | The new period **starts on the payment date**. The admin can edit the start date (it defaults to today) for payments recorded late or agreed backdating. |
| B3 | Early renewal | If paid while a period is still running, the new period **starts when the current one ends**. Leftover credits stay usable until then; nothing carries over. |
| B4 | Day 29–31 | Monthly, **keeping the original day** (anchor day). Jan 31 → Feb 28 → Mar 31. Clamp to the last day of short months. Only contiguous renewals (B3) keep the anchor; a late payment (B2) sets a new one. |
| B5 | Grace period | New gym setting `grace_days` (default 0). For N days after expiry the member can still check in, with a warning. Those visits **count against the next period** once paid. |
| B6 | Unlimited plans | Same periods; access until `end_date`, no credit count. |
| B7 | Plan / price changes | Apply at the next payment. Each period stores its own plan, credits and price, so editing a plan never changes paid periods. |
| B8 | Reporting | Dashboard lists: **expired** (end date, leftover credits, days since), **expiring in the next 7 days**, **out of credits before end date**. No WhatsApp action yet. |
| B9 | Pause / freeze | Not supported. |
| B10 | Cutover | Each existing `paid` payment record becomes a period starting at its `paid_at` date. Generated `pending`/`overdue` rows are deleted. Dry-run report first. |
| B11 | Other gyms | Single model for every gym. A gym wanting calendar billing just starts periods on the 1st. |
| B12 | Over-limit setting | `allow_over_limit` stays and means "out of credits **inside** a paid period". Grace (B5) covers "period expired". |
| B13 | Enrollment | No separate "Inscribir en plan" step. The plan is chosen in "Registrar pago"; a member is "Sin plan" until their first payment. *(Confirmed 2026-10-05.)* |
| B14 | Kiosk privacy | The public kiosk shows the outcome only: no member name or DNI, since `/g/[slug]` is unauthenticated and DNIs are guessable. *(Confirmed 2026-10-05.)* |
| B15 | Cutover grace | `gym_settings.billing_cutover_date` (set by 0006). Grace counts from the later of the member's expiry and the cutover, so every member expired before the switch gets the full grace window from switch day. Visits before the cutover never count against a new period. Members who never paid get no grace. *(Decided 2026-10-24: Mystik had stopped recording payments.)* |

**Consequences:**
- No monthly cron, no generated `pending` rows, no `pending`/`overdue`
  statuses. A payment row exists only when money was received. "Owes money"
  is derived: the latest period has ended and there's no newer one.
- `gym_settings.auto_generate_payments`, `/api/cron/generate-payments`, the
  monthly `vercel.json` cron, `generateMonthlyPayments`, `generatePaymentsForGym`
  and the "Generar cuotas" / "Marcar vencidos" buttons are removed.
- **Enrollment as a separate step goes away.** The member's plan is the plan
  of their latest period. "Inscribir en plan" merges into "Registrar pago",
  which picks a plan prefilled from the last period. Members with no period
  show as "Sin plan" (B13).

---

## 3. Active work

Phases run in order. Each phase lists what it fixes from the 2026-10-01
architecture review. Per `CONVENTIONS.md`, every change to check-in,
credits or payments ships with tests.

### Phase 1 — Billing redesign (payment-anchored periods)

**Status (2026-10-24): deployed to production.**

How it works:
- `lib/db/migrations/0006_membership_periods.sql`: new `membership_periods`
  table (EXCLUDE constraint = no overlapping periods per member),
  `visits.visit_date` + `UNIQUE(member_id, visit_date)` (one visit per day
  enforced by the DB), `visits.period_id`, `gym_settings.grace_days`, and
  the `member_standing` view. The view is the single source of truth for
  status (active / grace / expired / no_plan / not_started) and credits.
  The migration also performs the cutover (paid payments → periods, deletes
  generated pending/overdue rows).
- `lib/domain/period-math.ts`: pure date rules B1–B4 (shared by the server
  and the register-payment dialog's live preview).
- `lib/domain/payments.ts` → `recordPayment` (one transaction: lock member,
  compute period, insert payment + period, attach grace/backdated visits),
  `deletePayment` (cascades the period; its visits become unassigned).
- `lib/domain/fichaje.ts` → pure `decideFichaje` + `recordVisit` using
  `ON CONFLICT DO NOTHING`. The kiosk returns no member name or DNI.
- Enrollments are no longer used by code; the monthly cron,
  "Generar cuotas" and "Marcar vencidos" are gone (`vercel.json` now only
  holds the keep-alive).
- Dashboard (`lib/domain/dashboard.ts`): "Vencidos" is split into
  "que siguen viniendo" (visit in the last 30 days: chase today) and
  "sin venir" (win back or deactivate); a card lists active members with no
  visit, period or sign-up in 60+ days and deactivates them in bulk; a banner
  counts today's grace check-ins. Thresholds live in `lib/domain/activity.ts`.
  The members list gained `payment=lapsed` (grace + expired) and
  `seen=recent|away`, which the "Ver todos" links use.
- Tests: `tests/unit/{period-math,fichaje,payments,kiosk}.test.ts` and
  `tests/integration/{billing,dashboard}.test.ts` (real Postgres, `npm run test:integration`).

Remaining:
- [x] Production dry run (2026-10-05): 308 paid → 308 periods, 39
  pending/overdue deleted, 0 duplicate visit days. Only 4 of 209 active
  members end up with a current period: Mystik records few of the payments
  it collects (the old check-in never required one).
- [x] Mystik confirmed (2026-10-14) they had stopped recording payments, so
  most members show as expired. Handled by B15.
- [x] Production dry run with the cutover rule (2026-10-24, `--grace 14`):
  181 grace, 27 never paid (blocked), 1 active.
- [x] Production rollout (2026-10-24): `pg_dump` of public + auth to
  `~/gymdex-backups/prod-before-0006-2026-10-24T1547.dump` → 0006 +
  `grace_days = 14` in one transaction → pushed `de39307`, deployed.
  Result: 308 periods, 181 grace, 27 never paid, 1 active.
- [x] Production smoke test passed (2026-10-24), including the keep-alive.
- [ ] ~2026-11-07: lower `grace_days` to 7.
- [ ] Follow-up migration 0007 once verified in production: drop
  `payment_records.period_start/period_end/status/enrollment_id`, the
  `payment_status` enum, `gym_settings.auto_generate_payments` and the
  `enrollments` table.

### Phase 2 — Integrity and security fixes (not covered by Phase 1)

- [ ] Create member: run the DB writes in a transaction and delete the
  Supabase Auth user if they fail (today a duplicate DNI leaves an orphaned
  login). Extract one `createMemberAccount()` shared by create, update and
  bulk import.
- [ ] Gym creation: insert `gyms` + `gym_settings` in one transaction.
- [x] Kiosk action returns only the outcome (done in Phase 1).
- [ ] Kiosk rate limit: key by `slug + IP` with a higher ceiling. Members
  share the gym's Wi-Fi IP, so 10 requests / 10 s per IP can block the rush hour.
- [ ] Validate `timezone` with `Intl.supportedValuesOf('timeZone')` on gym
  create and settings save (an invalid value breaks every query for that gym).
- [ ] Member portal password: force a change on first login (initial
  password = DNI is guessable).
- [ ] Detect unique violations by Postgres code `23505`, not
  `message.includes('unique')`.
- [ ] Bulk import: re-validate rows on the server (required fields, date
  format); don't trust client parsing.

### Phase 3 — Quality and infrastructure

- [ ] `parseForm(zodSchema, formData)` helper. Migrate actions to typed,
  validated input (zod is already a dependency).
- [ ] `withAction(name, fn)` wrapper: consistent try/catch, Sentry,
  `logger` outcome + duration, `{ error }` on failure. Covers "log server
  action outcomes" and the kiosk's missing error handling.
- [ ] DB pool: raise `max` from 1 to ~5 in `lib/db/client.ts` (Fluid
  Compute shares instances across requests); measure before/after.
- [ ] Wrap `requireGymAdmin` / layout user lookups in React `cache()`. Use
  `getClaims()` in `proxy.ts` and skip auth work on `/legal`.
- [ ] Commit the RLS policies as a migration under `supabase/migrations/`.
- [ ] Pick one role source (`app_metadata.role`) and drop `profiles.role`
  or document it as a mirror.
- [x] Integration test harness against local Postgres (`tests/integration/`,
  `npm run test:integration`). Billing is covered; extend it to members,
  credit adjustments and bulk import as those get touched.

---

## 4. Backlog

Not scheduled. Pull into Active work when needed.

**Product**
- WhatsApp reminder button on expiring / expired members (`wa.me` link with
  prefilled message).
- "Olvidé mi contraseña": `resetPasswordForEmail` + `/reset-password` +
  Supabase SMTP. Superadmin reset covers the urgent case today.

**Observability**
- Log rate-limit hits in `proxy.ts`: `{ event: 'rate_limit.hit', ip, path, gymSlug }`.
- Slow-query logging: warn when a domain call exceeds 800 ms.
- `/api/healthz` (`SELECT 1`) wired to an uptime monitor.
- Log retention: Vercel Hobby keeps 1 day; decide on a 30-day option
  (Pro + Axiom drain).

**Testing**
- E2E (Playwright): admin golden path (create member → register payment →
  check in → credits decrement) and member portal smoke test.

**Legal**
- NDA / confidentiality clause: a document outside the app, sent with each
  new gym's onboarding.
