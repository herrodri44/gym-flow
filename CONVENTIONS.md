# Codebase Conventions

## Pages are renderers, not data orchestrators

A page or layout component has one job: render. If it needs data, it must
delegate to a domain function in `lib/domain/`.

**The rule:** any page that requires more than a single, straightforward
single-table query must call a domain function instead of querying inline.

```
// WRONG — queries belong in lib/domain/
export default async function MyPage() {
  const [gym] = await db.select().from(gyms).where(...)
  const [member] = await db.select().from(members).where(...)
  const visits = await db.select().from(visits).where(...)
  return <div>...</div>
}

// RIGHT — page is a thin renderer
export default async function MyPage() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const data = await getMyPageData(user.id, gymId)
  return <div>...</div>
}
```

**Why:** Domain functions are testable, reusable, and localize change.
If the query logic lives in a page, it cannot be shared and cannot be
tested without rendering. See `lib/domain/member.ts` for a worked example.

### How to structure queries inside a domain function

Minimize DB round trips by using this two-step pattern:

1. **Anchor query** — fetch the central entity. If you need a field from a
   related table to parameterize subsequent queries (e.g. `gymTimezone` for
   building a month-boundary SQL fragment), JOIN it here.

2. **Parallel batch** — once you have everything from step 1, fire all
   remaining independent queries in a single `Promise.all([...])`.

This keeps any page at 2–3 DB round trips regardless of how many queries
are needed, instead of N sequential `await` calls.

```typescript
// lib/domain/example.ts

export async function getExampleData(userId: string) {
  // Round trip 1: anchor + any deps needed to build subsequent queries
  const [row] = await db
    .select({ id: entities.id, gymTimezone: gyms.timezone, ... })
    .from(entities)
    .innerJoin(gyms, eq(gyms.id, entities.gymId))
    .where(eq(entities.userId, userId))
    .limit(1)

  if (!row) return null

  const monthStart = sql`(date_trunc('month', now() AT TIME ZONE ${row.gymTimezone}) ...)`

  // Round trip 2: everything else in parallel
  const [aRows, bRows, cRows] = await Promise.all([
    db.select(...).from(tableA).where(...),
    db.select(...).from(tableB).where(...monthStart...),
    db.select(...).from(tableC).where(...),
  ])

  // Business logic lives here, not in the page
  return { ... }
}
```

### What stays in the page

- Supabase auth check (`supabase.auth.getUser()` + redirect)
- The domain function call
- JSX rendering
- UI-only helper functions (date formatting, class names, etc.)

---

## Server Actions are thin adapters

The same rule as pages, applied to Server Actions. An action has one job:
parse `formData`, check auth, delegate to a domain function, return the result.
Business logic does not belong in actions.

```typescript
// WRONG — logic inline in the action
export async function createGymAction(formData: FormData) {
  const { data: { user } } = await supabase.auth.getUser()
  const name = formData.get('name') as string
  const slug = name.toLowerCase().normalize('NFD').replace(...) // logic
  await db.insert(gyms).values({ name, slug })                  // logic
  revalidatePath('/superadmin/gyms')
}

// RIGHT — action delegates to domain
export async function createGymAction(formData: FormData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.app_metadata?.role !== 'superadmin') redirect('/login')
  const name = formData.get('name') as string
  return createGym({ name })   // domain owns slug generation, insert, etc.
}
```

**Why:** Domain functions are reusable and testable. If the logic lives in
an action, it can only be triggered via a form submission and cannot be
called from other contexts (e.g. a future API route or a seed script).

Actions return a consistent shape: `{ error: string }` on failure, or
redirect / `{ success: true }` on success. Never throw from an action.

---

## Use Drizzle builders for simple queries, raw SQL for complex

The codebase uses both styles. The rule for choosing:

- **Drizzle builders** (`db.select().from(...).where(...)`) — single table or
  simple join, no aggregations, no CTEs, no window functions. Easy to read
  and refactor.

- **Raw SQL** (`db.execute(sql\`...\`)`) — CTEs, `generate_series`,
  `date_trunc`, aggregations, `GROUP BY`, window functions. Use when the
  query would become unreadable as a builder chain.

Never mix both styles in the same query. If a Drizzle builder query starts
growing raw `sql\`...\`` fragments for non-trivial expressions, convert the
whole query to raw SQL for consistency.

```typescript
// Simple — Drizzle builder
const [member] = await db
  .select()
  .from(members)
  .where(and(eq(members.gymId, gymId), eq(members.active, 'true')))
  .limit(1)

// Complex — raw SQL (CTEs, generate_series, timezone truncation)
const rows = await db.execute<Row>(sql`
  WITH monthly AS (
    SELECT date_trunc('month', generate_series(...)) AS month
  )
  SELECT ...
`)
```

---

## Money is always centavos in the DB, always `formatARS` in the UI

The schema stores all monetary values as `integer` centavos ARS
(e.g. $1.500 → `150000`). Getting this wrong produces silent 100× bugs.

**Rules:**
- DB reads and writes: centavos, no conversion needed
- Displaying to users: always `formatARS(centavos)` from `lib/utils.ts`
- Collecting from users (forms): always `pesosTocentavos(pesos)` from `lib/utils.ts`
- Never multiply or divide by 100 inline in a page, action, or domain function

```typescript
// WRONG
<span>{(plan.priceArs / 100).toFixed(2)}</span>
await db.insert(paymentRecords).values({ amountArs: pesos * 100 })

// RIGHT
<span>{formatARS(plan.priceArs)}</span>
await db.insert(paymentRecords).values({ amountArs: pesosTocentavos(pesos) })
```

---

## Separate reads from writes in domain functions

Domain functions that validate or fetch data must not have side effects.
Domain functions that write must not return unvalidated results. Keep them
separate so callers can safely show a preview before committing.

`lib/domain/fichaje.ts` is the canonical example:
- `validateFichaje(...)` — pure read, returns a result, touches nothing
- `recordVisit(...)` — pure write, called only after validation confirms it is safe

**Naming signals intent:**
- `get*` / `validate*` / `find*` / `calculate*` — reads only, no side effects
- `create*` / `record*` / `update*` / `delete*` — writes, called only after
  reads confirm validity

```typescript
// WRONG — validation and mutation tangled together
export async function checkInMember(documentNumber: string, gymId: string) {
  const member = await findMember(documentNumber, gymId)
  if (!member) throw new Error('not found')
  await db.insert(visits).values(...)  // writes before caller can confirm
  return member
}

// RIGHT — separate functions, caller controls the commit
export async function validateFichaje(...) { /* read only */ }
export async function recordVisit(...)     { /* write only */ }
```

---

## Never use `as unknown as` to silence type errors

Type casts that go through `unknown` hide real mismatches between what the
code assumes and what it receives at runtime. They produce bugs that compile
cleanly and fail silently.

```typescript
// WRONG — hides that periodStart is a Date, not a string
formatDate(p.periodStart as unknown as string)

// RIGHT — fix the function to accept the actual type
function formatDate(value: string | Date | null | undefined) { ... }
```

If you feel the urge to write `as unknown as X`, stop and ask: is the type
declaration wrong, or is the function's signature wrong? Fix whichever is
incorrect. The only acceptable use of `as` is narrowing within a type
hierarchy (e.g. `value as SpecificSubtype`), never widening or escaping.
