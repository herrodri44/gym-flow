# Testing

## Stack

- **Vitest 3** — test runner and assertion library
- **vite-tsconfig-paths** — resolves `@/*` path aliases inside tests
- **@vitest/coverage-v8** — coverage reports (optional)

## Commands

```bash
npm test              # single run (CI)
npm run test:watch    # watch mode (development)
npm run test:coverage # single run + lcov coverage report
```

## Where tests live

```
tests/
  helpers/
    db-mock.ts          # shared mock factories for Drizzle's chainable API
  unit/
    credits.test.ts     # getAvailableCredits — lib/domain/credits.ts
    fichaje.test.ts     # validateFichaje / validateMemberFichaje — lib/domain/fichaje.ts
    enrollment.test.ts  # enrollMemberAction — app/admin/(protected)/plans/actions.ts
    payments.test.ts    # registerPaymentAction, markOverdueAction, updatePaymentStatusAction
    proxy.test.ts       # route protection and rate limiting — proxy.ts
    kiosk.test.ts       # publicFichajeAction — app/g/[slug]/actions.ts
```

## How DB mocking works

The domain functions call Drizzle's chainable query API:

```ts
// Pattern A — terminates with .limit()
const [row] = await db.select({...}).from(table).innerJoin(...).where(...).limit(1)

// Pattern B — aggregates, awaited directly (no .limit())
const [{ count }] = await db.select({ count: count() }).from(table).where(...)
```

Both patterns are handled by `makeSelectChain(value[])` in `tests/helpers/db-mock.ts`.
Each call to `db.select()` gets its own independent chain.
Set up multiple select calls in sequence with `mockReturnValueOnce`:

```ts
mockSelect
  .mockReturnValueOnce(makeSelectChain([{ planType: 'credits', creditsPerMonth: 10 }]))
  .mockReturnValueOnce(makeSelectChain([{ visitCount: 3 }]))
  .mockReturnValueOnce(makeSelectChain([{ adjustmentSum: null }]))
```

The mock does **not** execute SQL. Arguments passed to `.where()`, `.innerJoin()`, etc.
are discarded. Tests verify business logic (which status is returned, which DB method
is called, in what order), not SQL correctness.

## Key mocking decisions

### @/lib/db/client
Mocked entirely. No Postgres connection is ever opened during tests.

### @/lib/domain/credits (in fichaje tests)
`getAvailableCredits` is mocked so `validateMemberFichaje` tests can control
credit results directly without chaining through the credits module's own DB calls.

### next/cache and @/lib/auth/context (in action tests)
`revalidatePath` and `requireGymAdmin` are mocked so server action tests run
in plain Node without the Next.js runtime.

### @supabase/ssr, @upstash/ratelimit, @upstash/redis (in proxy tests)
These are mocked because `proxy.ts` initialises a `Ratelimit` instance at module
load time (before any request). `vi.hoisted()` is used to share the mock function
references between the `vi.mock` factory (which is hoisted to the top of the file)
and the test bodies:

```ts
const { mockRatelimitLimit, mockGetUser } = vi.hoisted(() => ({
  mockRatelimitLimit: vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@upstash/ratelimit', () => {
  const Mock = vi.fn().mockImplementation(() => ({ limit: mockRatelimitLimit }))
  ;(Mock as any).slidingWindow = vi.fn()
  return { Ratelimit: Mock }
})
```

### @/lib/domain/fichaje (in kiosk tests)
`validateFichaje` and `recordVisit` are mocked in `kiosk.test.ts` so the action's
routing logic (which statuses trigger `recordVisit`, which don't) can be tested
independently of the fichaje domain logic already covered in `fichaje.test.ts`.

## Config note

The config file is `vitest.config.mts` (`.mts`, not `.ts`). This project does not
have `"type": "module"` in package.json, so Node treats plain `.ts` files as CJS.
The `.mts` extension forces ESM, which is required by `vite-tsconfig-paths`.

## What is NOT tested here (and why)

| Area | Reason |
|---|---|
| SQL correctness (timezone math, CTEs) | Requires a real Postgres database — see TODO.md LOW section |
| Kiosk UI (success/error screens) | Requires Playwright + running server — see TODO.md LOW section |
| Admin golden path E2E | Requires Playwright + running server — see TODO.md LOW section |
| RLS policies | Tested via Supabase Dashboard or a seeded integration test DB |

## Adding new tests

**For a domain function or server action:**

1. Create `tests/unit/<name>.test.ts`
2. Mock `@/lib/db/client` with `vi.mock` before any imports
3. Use `makeSelectChain` for select queries; `makeInsertMock` / `makeUpdateMock` for writes
4. Mock `next/cache` (`revalidatePath`) and `@/lib/auth/context` (`requireGymAdmin`) for actions
5. Import the module under test **after** all `vi.mock` calls (`await import(...)`)
6. Call `mockReset()` / `mockClear()` on all mocks in `beforeEach`

**For a module with module-level side effects (like `proxy.ts`):**

Use `vi.hoisted()` to share mock references between `vi.mock` factories and test
bodies — factory functions cannot close over variables defined in module scope
because `vi.mock` is hoisted above them at compile time.
