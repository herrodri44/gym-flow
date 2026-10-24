# Debugging Guide

Goal: find the root cause of any user-reported issue in under 5 minutes.

---

## Observability stack

| Layer | Tool | What it catches |
|---|---|---|
| Error tracking | **Sentry** | Unhandled exceptions, captured DB errors in actions |
| Structured logs | **`lib/logger.ts`** → Vercel log drain | Every check-in attempt, payment errors, server warnings |
| Development | `console.log` with `[INFO]`/`[WARN]`/`[ERROR]` prefix | Same events, human-readable in terminal |

---

## Environment variables required

Add these before deploying to production:

```bash
# .env.local (never commit)
SENTRY_DSN=https://...@sentry.io/...          # server-side error capture
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...  # client-side error capture (same DSN is fine)
```

---

## Viewing logs

### Local development

Run `npm run dev` and watch the terminal. Every structured event prints like:

```
[INFO] fichaje.attempt { gymId: 'abc', memberId: 'xyz', channel: 'fichaje_public', outcome: 'allowed', creditsRemaining: 5 }
[WARN] fichaje.attempt { channel: 'fichaje_public', outcome: 'invalid_gym', gymSlug: 'mi-gym' }
[ERROR] No se pudo guardar el pago { gymId: 'abc', action: 'registerPayment' }
```

### Vercel (production)

1. Open the Vercel dashboard → project → **Logs** tab
2. Filter by **Function** logs (not Edge/Static)
3. Each log line is a JSON object — Vercel renders them collapsed; click to expand

Example production log line:
```json
{"level":"info","event":"fichaje.attempt","ts":"2026-05-19T18:30:00.000Z","gymId":"...","memberId":"...","channel":"fichaje_public","outcome":"allowed","creditsRemaining":3}
```

**Search tips for Vercel logs:**
- `fichaje.attempt` → all check-in attempts
- `outcome":"denied` → denied check-ins only
- `"level":"error"` → all errors
- `"gymId":"<id>"` → narrow to one gym
- `"action":"registerPayment"` → payment errors

### Vercel log drain to Axiom (recommended for 30+ day retention)

Vercel Hobby keeps logs for **1 day**. For production, set up an Axiom log drain:

1. Create a free Axiom account → create a dataset named `gym-flow`
2. In Vercel: Settings → Log Drains → Add drain → HTTP → Axiom ingest URL
3. All `console.log` JSON output flows there automatically
4. In Axiom, use APL queries:
   ```
   ['gym-flow']
   | where event == "fichaje.attempt"
   | where outcome == "over_limit_denied"
   | sort by _time desc
   ```

---

## Sentry error tracking

Sentry captures:
- All unhandled server exceptions (via `instrumentation.ts` + `onRequestError`)
- DB errors in payment and fichaje actions (via explicit `Sentry.captureException`)

### Finding an error in Sentry

1. Open Sentry → Issues tab
2. Filter by `environment:production`
3. Click the error → **"Extra" section** shows `gymId`, `action`, and other context

### Capturing errors in new actions

When you add a new server action that writes to the DB, wrap the DB call:

```typescript
import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'

export async function myNewAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  // ... parse formData ...

  try {
    await db.insert(myTable).values({ ... })
  } catch (err) {
    Sentry.captureException(err, { extra: { gymId: ctx.gymId, action: 'myNewAction' } })
    logger.error(err as Error, { gymId: ctx.gymId, action: 'myNewAction' })
    return { error: 'No se pudo guardar' }
  }

  revalidatePath('/admin/...')
  return { success: true }
}
```

**Why this pattern matters:** Without the try/catch, a DB error propagates to Next.js as a 500 response. The user sees a generic error page and you have no context. With it: Sentry has the full stack trace + gymId, the logger has a queryable JSON line, and the user gets a clean message.

---

## Common scenarios

### "My payment didn't save"

1. **Sentry first**: Is there an error in the last hour with `action: "registerPayment"`? If yes, the error is in Sentry with full stack trace.
2. **Vercel logs**: Search `"action":"registerPayment"` — look for `"level":"error"` lines.
3. **DB check**: In Supabase → Table editor → `payment_records` → filter by `memberId` and date. If the row is there, the issue is display (revalidation). If it's not, the insert failed.

### "It said I had no credits / wrong credit count"

1. **Vercel logs**: Search `fichaje.attempt` + `memberId`. Find the check-in in question. The `outcome` and `creditsRemaining` fields tell you what the system saw at check-in time.
2. **DB check**: In Supabase:
   - `SELECT * FROM member_standing WHERE member_id = '<uuid>'` — status,
     the reference period, credits used/left and grace visits in one row
   - `membership_periods`: does the member have a period covering today?
   - `visits` with `period_id IS NULL`: grace (or pre-payment) visits not yet
     attached to a period
3. **Reproduce**: Use the fichaje admin panel with the member's document number. Watch the dev terminal for the `fichaje.attempt` log.

### "Check-in failed / nothing happened"

1. Check Sentry for errors in the last 5 minutes with `action: "registerFichaje"` or `action: "registerPayment"`.
2. Check Vercel logs for `"level":"error"` near the reported time.
3. If no errors: the action returned a denial status. Search `fichaje.attempt` + `memberId` to see the `outcome`.

### "The kiosk stopped working"

Check the rate limiter first:

```
Vercel logs → search: "rate_limit.hit"  (once this is instrumented — see PLAN.md Backlog)
```

Until then: check Upstash Redis in the Upstash console — if requests from the kiosk IP are being rate-limited, the limiter is configured too tightly or the kiosk is looping.

---

## Using Claude to analyze logs

### Paste logs, ask for root cause

Copy a block of JSON logs from Vercel or Axiom, paste into Claude, and ask:

```
These are structured logs from a gym management app.
A user reported that their check-in failed at around 18:30 UTC.
What went wrong?

[paste log lines here]
```

### Paste a Sentry error, ask for fix

Copy the full Sentry error (title, stack trace, breadcrumbs, "Extra" context) and ask:

```
This is a Sentry error from our Next.js app.
The action is 'registerPayment' in app/admin/(protected)/payments/actions.ts.
What is the likely cause and how do I fix it?

[paste Sentry error here]
```

### Diagnose a credit count discrepancy

```
A member (id: "abc") should have had 3 credits left but the system showed 0.
Here is the relevant DB state:

member_standing: [paste row]
membership_periods: [paste rows]
visits for the period (and with period_id null): [paste rows]
credit_adjustments: [paste rows]

Credits are computed by the member_standing view in
lib/db/migrations/0006_membership_periods.sql: [paste view]

What went wrong?
```

---

## Structured log event reference

| event | level | when emitted |
|---|---|---|
| `fichaje.attempt` | info | Every check-in attempt (public kiosk + admin panel) |
| `fichaje.attempt` | warn | `invalid_gym` — slug not found (public kiosk) |
| `payment.recorded` | info | Payment + period saved (`periodStart`, `periodEnd`) |
| `registerPayment` | error | DB error saving a payment record |
| `deletePayment` | error | DB error deleting a payment |
| `registerFichaje` | error | DB error saving a visit row |

### `fichaje.attempt` context fields

```typescript
{
  gymId: string           // UUID of the gym
  memberId?: string       // UUID of the member (undefined for not_found / invalid_gym)
  channel: 'fichaje_public' | 'fichaje_admin'
  outcome:
    | 'ok'                // check-in recorded, credits > 0 or unlimited
    | 'over_limit_allowed'// check-in recorded, credits exhausted but gym allows it
    | 'grace_allowed'     // check-in recorded, period expired but within grace days
    | 'over_limit_denied' // check-in NOT recorded, credits exhausted
    | 'already_today'     // check-in NOT recorded, already checked in today
    | 'expired'           // check-in NOT recorded, period ended and grace is over
    | 'no_plan'           // check-in NOT recorded, member never paid
    | 'not_started'       // check-in NOT recorded, period starts in the future
    | 'not_found'         // check-in NOT recorded, document number unknown
    | 'invalid_gym'       // check-in NOT recorded, gym slug not found
  creditsRemaining?: number | null  // null = unlimited, 0 = exhausted, N = remaining
  gymSlug?: string        // only on invalid_gym
}
```

---

## Local debugging tips

### Simulate production JSON logs locally

```bash
NODE_ENV=production npm run dev
```

The logger switches to JSON output — useful to verify the log shape before deploying.

### Add a one-off debug log

```typescript
import { logger } from '@/lib/logger'

logger.info('debug.checkpoint', { value: someVar, gymId: ctx.gymId })
```

Remove before committing. The `debug.` prefix makes it easy to `grep` and clean up.

### Check DB state without a UI

Use Supabase's built-in SQL editor (project dashboard → SQL Editor):

```sql
-- What can this member do right now? (status, period, credits)
SELECT status, plan_name, start_date, end_date, credits_granted, credits_used,
       credits_adjusted, credits_left, grace_visits, days_left, days_since_expiry
FROM member_standing
WHERE member_id = '<member-uuid>';
```
