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

- [x] **Missing RLS policy for `credit_adjustments` table** — aplicado en
  Supabase SQL editor. Políticas: gym_admin (SELECT/INSERT/DELETE filtrado
  por `gym_admins`), superadmin (ALL), member (SELECT propio via `members.user_id`).

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

- [x] **Error tracking: Sentry** — Installed `@sentry/nextjs`. Wired up
  `instrumentation.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`,
  and `withSentryConfig` in `next.config.ts`. Added `Sentry.captureException`
  + try/catch in `payments/actions.ts` and `check-in/actions.ts` so DB errors
  are captured before being converted to `{ error: string }`. See `DEBUGGING.md`
  for the pattern to follow in new actions. Add `SENTRY_DSN` and
  `NEXT_PUBLIC_SENTRY_DSN` to env before deploying.

- [x] **Structured logger (`lib/logger.ts`)** — Dependency-free thin wrapper:
  `logger.info(event, ctx)`, `logger.warn(...)`, `logger.error(err, ctx)`.
  Dev: human-readable `[LEVEL] event {ctx}`. Production: JSON lines for
  Vercel log drain or Axiom. Shape: `{ level, event, ts, gymId?, memberId?,
  durationMs?, ...ctx }`.

- [x] **Instrument the fichaje flow** — Every check-in attempt emits a
  structured log `{ event: 'fichaje.attempt', gymId, memberId, channel,
  outcome, creditsRemaining }` from both `publicFichajeAction` and
  `registerFichajeAction`. See `DEBUGGING.md` for the full field reference
  and how to query these logs in Vercel / Axiom.

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

---

## Pendiente — Socios: Notas y Carga Masiva

### Campo de Notas en socios

Permite al admin registrar notas internas sobre cada socio (objetivos, advertencias, contexto).

**Pasos:**

1. **Migración** — `0004_member_notes.sql`
   ```sql
   ALTER TABLE members ADD COLUMN notes text;
   ```

2. **Schema** — agregar `notes: text('notes')` a la tabla `members` en `lib/db/schema.ts`

3. **Domain** — incluir `notes` en el SELECT de `getMemberDetail()` en `lib/domain/member-detail.ts`

4. **Action** — agregar `notes` al `updateMemberAction` en `app/admin/(protected)/members/actions.ts`

5. **UI** — en la página de detalle del socio (`app/admin/(protected)/members/[id]/page.tsx`), agregar una sección con un `<textarea>` editable que guarde vía un form action o inline edit. Mostrar debajo de la info básica del socio en el panel derecho.

---

### Carga masiva de socios (Bulk CSV Upload)

Ayuda a gimnasios nuevos a importar toda su base de socios desde un CSV.
Ubicación: página de Configuración (`/admin/settings`), nueva sección "Importar socios".

**Flujo de usuario:**
1. Admin descarga un CSV template con las columnas correctas
2. Completa el archivo en Excel/Sheets
3. Sube el archivo → se parsea y muestra una tabla de preview con errores resaltados
4. Confirma la carga → se insertan los registros válidos
5. Se muestra resumen: "X socios creados, Y omitidos (DNI duplicado), Z con errores"

**Campos del CSV template:**

| Columna | Requerido |
|---|---|
| `primer_nombre` | ✓ |
| `apellido` | ✓ |
| `dni` | ✓ |
| `telefono` | — |
| `email` | — |
| `fecha_nacimiento` | — (formato YYYY-MM-DD) |
| `fecha_ingreso` | — (formato YYYY-MM-DD) |

`primer_nombre` + `apellido` se concatenan → `fullName` al procesar.

**Pasos de implementación:**

1. **Template CSV** — archivo estático `public/templates/socios-template.csv` con headers y una fila de ejemplo. El botón "Descargar template" apunta a este archivo.

2. **Domain function** — `lib/domain/members-bulk.ts` → `bulkCreateMembers(gymId, rows[])`:
   - Valida cada fila (campos requeridos, formato de fechas, DNI no vacío)
   - Hace un batch de todos los DNIs existentes en el gym para detectar duplicados sin N+1
   - Inserta en un loop (no en un único bulk insert, para poder reportar errores por fila)
   - Si hay email: intenta crear cuenta Supabase (igual que `createMemberAction`); fallo no-crítico
   - Retorna `{ created: number, skipped: number, errors: RowError[] }`

3. **Server Action** — `bulkCreateMembersAction(formData)` en `app/admin/(protected)/settings/actions.ts`:
   - Parsea el archivo CSV server-side (sin dependencias, CSV es simple de parsear con `split`)
   - Delega a `bulkCreateMembers`
   - Retorna el resumen

4. **UI** — nuevo componente `app/admin/(protected)/settings/_components/bulk-member-upload.tsx`:
   - Sección con descripción: campos obligatorios, formato esperado
   - Botón "Descargar template CSV"
   - `<input type="file" accept=".csv">`
   - Al seleccionar archivo: parseo client-side con preview de las primeras filas (sin enviar aún)
   - Botón "Importar" → llama al server action
   - Muestra spinner mientras procesa
   - Muestra resultado final: tabla con errores + resumen de creados/omitidos

5. **Settings page** — agregar la nueva sección `<BulkMemberUpload />` con un `<Separator />` antes

**Consideraciones:**
- Máximo razonable: 500 filas por upload (validar en action y en el UI)
- El CSV template debe tener una fila de ejemplo comentada o con datos ficticios de muestra
- Los errores por fila deben indicar el número de fila y el motivo (ej. "Fila 5: DNI duplicado")

---

### Gap — Edición de socio: email no crea cuenta Supabase

Al editar un socio y agregarle email por primera vez, `updateMemberAction` actualiza la DB pero no crea el usuario en Supabase Auth. El socio queda sin acceso al portal.

**Fix:** En `updateMemberAction`, si el campo `email` es nuevo (antes era null) y el socio no tiene `userId`, replicar la lógica de creación de cuenta de `createMemberAction`: `adminClient.auth.admin.createUser(...)` → `db.insert(profiles)` → actualizar `userId` en la fila del socio, todo dentro del mismo try/catch.

---

## Mobile UX

Goal: cada página debe ser usable desde un celular. La navegación debe estar siempre visible e interactable. Usar daisyUI 5 para primitivos de layout mobile; mantener Base UI para componentes interactivos complejos (dialogs, dropdowns, selects).

- [x] **Instalar daisyUI 5 + definir patrón de navegación mobile** — drawer slide-in con `MobileNavDrawer` en el navbar del admin; daisyUI `menu` para los items; siempre visible en mobile
- [x] `/g/[slug]` — QR check-in público (mayor prioridad: lo usan socios desde su celular)
- [x] `/portal/account` — portal del socio
- [x] `/admin/check-in` — panel de recepción (puede usarse desde tablet/celular)
- [x] `/admin/dashboard` — dashboard del admin
- [x] `/admin/members` — lista de socios + detalle
- [x] `/admin/payments` — libro de pagos
- [x] `/admin/plans` — gestión de planes
- [x] `/admin/settings` — configuración del gym
- [x] `/superadmin/**` — páginas de superadmin

---

## Legal y Cumplimiento

Requerimientos legales para operar GymDex con gimnasios clientes. Aplica la Ley 25.326 de Protección de Datos Personales (Argentina).

---

### 1. Política de Privacidad (Ley 25.326) — HIGH

**Por qué:** Es obligatoria. Los servidores almacenan datos personales de ciudadanos argentinos (nombre, DNI, asistencia). No cumplirla expone a GymDex a sanciones de la AAIP.

**Contenido mínimo del texto:**
- GymDex actúa como "encargado de tratamiento" (contenedor tecnológico); el gimnasio es el "responsable del tratamiento"
- Los datos se usan exclusivamente para que el gimnasio gestione sus membresías
- GymDex no vende ni comparte datos con terceros ni los usa con fines publicitarios
- Derecho de acceso, rectificación y supresión (ARCO) — contacto: `hernan@covr.care`
- Los datos se alojan en servidores de Supabase/Vercel (infraestructura en la nube)

**Implementación técnica:**
- [ ] Crear página estática `/legal/privacidad` con el texto completo
- [ ] Agregar `FooterLegal` component (`components/footer-legal.tsx`) con links a Privacidad y Términos
- [ ] Incluir el footer en los layouts: `app/admin/(protected)/layout.tsx`, `app/portal/layout.tsx`, `app/g/[slug]/page.tsx` (la pública del QR es la más importante)

---

### 2. Términos y Condiciones B2B (Acuerdo de Uso) — HIGH

**Por qué:** Define la relación contractual entre GymDex y cada gimnasio cliente. Protege ante reclamos por caídas del servicio o errores de registro de pagos.

**Contenido mínimo:**
- **Exención de responsabilidad por cobros:** GymDex es un sistema de registro interno; no procesa, intermedia ni audita pagos. La veracidad de si un socio pagó es responsabilidad exclusiva del gimnasio.
- **Continuidad del servicio:** El sistema está en fase piloto/desarrollo. GymDex no garantiza disponibilidad 24/7 ni se hace responsable por interrupciones temporales.
- **Propiedad de datos:** Los datos cargados son propiedad del gimnasio; GymDex tiene derecho a alojarlos en sus servidores únicamente para prestar el servicio.
- **Confidencialidad:** GymDex se compromete a no revelar ni usar la información comercial del gimnasio ni los datos de sus socios para ningún fin ajeno al servicio.

**Implementación técnica:**
- [ ] Crear página estática `/legal/terminos` con el texto completo
- [ ] Agregar link en `FooterLegal`
- [ ] **Aceptación en primer login:** agregar campo `terms_accepted_at (timestamptz)` a la tabla `profiles`. En el primer ingreso del admin, mostrar un modal no-closeable con el texto resumido y un checkbox "Leí y acepto los Términos y Condiciones". Guardar timestamp al aceptar. El proxy/middleware verifica este campo y redirige a `/onboarding/aceptar-terminos` si es null.

---

### 3. NDA / Cláusula de Confidencialidad — MEDIUM

**Por qué:** El desarrollador tiene acceso directo a la base de datos (lista de clientes del gimnasio, recaudación, etc.). Formaliza la relación de confianza y protege al gimnasio cliente.

**Formato:** No requiere implementación técnica en la app. Es un documento PDF adjunto al Acuerdo de Uso (punto 2) o enviado por separado al firmar como cliente. No hace falta una pantalla para esto.

**Contenido:** "GymDex y su equipo se comprometen a mantener estricta confidencialidad sobre la información comercial del gimnasio y los datos personales de sus asociados, no pudiendo revelarlos ni utilizarlos para ningún fin ajeno a la prestación del servicio."

- [ ] Redactar el documento (fuera de la app, puede ser un Google Doc → PDF)
- [ ] Enviarlo firmado digitalmente junto al onboarding de cada nuevo gimnasio cliente

---

## Done

- [x] **`app/portal/account/page.tsx`** — extracted to `lib/domain/member.ts`
  → `getMemberPortalData(userId)`. Reduced from 5 sequential round trips to
  2, fixed a latent bug in `formatDate` for timestamp-typed period fields.

- [x] **Cambio de contraseña — gym admin** — nueva sección "Cuenta" en
  `/admin/settings` con `ChangePasswordDialog`. Verifica la contraseña actual
  via `signInWithPassword` antes de llamar `updateUser`. Action:
  `changePasswordAction` en `app/admin/(protected)/settings/actions.ts`.

- [x] **Reset de contraseña — superadmin** — nueva columna "Acciones" en
  `/superadmin/admins` con `ResetPasswordDialog` por fila. El superadmin
  ingresa una nueva contraseña temporal; la action usa
  `adminClient.auth.admin.updateUserById`. Action: `resetAdminPasswordAction`
  en `app/superadmin/admins/actions.ts`.
