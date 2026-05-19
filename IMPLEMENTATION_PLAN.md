# Gym-flow — Plan de Implementación

**Pila:** Next.js 15 (App Router) · Supabase (Postgres + Auth + RLS) · Drizzle ORM · Vercel  
**Idioma de interfaz:** Español (Argentina) · Moneda: ARS  
**Modelo de multi-tenancy:** aislamiento por `gym_id` en capa de aplicación + políticas RLS en Supabase

---

## Estructura de carpetas objetivo

```
gym-flow/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (superadmin)/           # rutas solo accesibles al Superadmin
│   │   ├── gimnasios/
│   │   └── administradores/
│   ├── (admin)/                # rutas del Admin de gimnasio (requiere gym activo)
│   │   ├── dashboard/
│   │   ├── socios/
│   │   ├── planes/
│   │   ├── fichaje/
│   │   ├── pagos/
│   │   ├── configuracion/
│   │   └── analiticas/
│   ├── (portal)/               # portal del socio (autenticado)
│   │   └── mi-cuenta/
│   └── g/
│       └── [slug]/             # página pública de fichaje por QR (sin login)
├── components/
│   ├── ui/                     # primitivos reutilizables
│   ├── admin/
│   ├── fichaje/
│   └── superadmin/
├── lib/
│   ├── db/
│   │   ├── client.ts           # instancia Drizzle
│   │   ├── schema.ts           # todas las tablas
│   │   └── migrations/
│   ├── auth/
│   │   ├── server.ts           # createServerClient helpers
│   │   └── roles.ts            # constantes de rol + helpers de verificación
│   └── domain/
│       ├── credits.ts          # cálculo de créditos disponibles
│       ├── fichaje.ts          # lógica de validación de ingreso
│       └── visits.ts           # regla 1 visita/día/socio/gym
├── middleware.ts               # RBAC global + resolución de gym activo
└── supabase/
    └── migrations/             # SQL de políticas RLS
```

---

## Decisiones de arquitectura fijas

| Decisión | Elección |
|----------|----------|
| Routing | App Router (Server Components por defecto) |
| Mutaciones | Server Actions (formularios) + Route Handlers (API pública QR) |
| Auth | Supabase Auth — roles almacenados en `profiles.role` (`superadmin`, `gym_admin`, `member`) |
| Multi-tenant | `gym_id` obligatorio en todas las tablas de datos; verificado en middleware + RLS |
| Gym activo | Almacenado en cookie de sesión (`active_gym_id`); resuelto en middleware |
| ORM | Drizzle con `drizzle-orm/postgres-js`; migraciones con `drizzle-kit` |
| Dinero | `integer` (centavos ARS) en BD; formateo `$ X.XXX` en UI |
| Créditos | Calculados en tiempo real desde filas `visits` (sin contador denormalizado en MVP) |
| Hosting | Vercel (variables de entorno por ambiente: `preview` y `production`) |

---

## Esquema de base de datos (Drizzle)

```ts
// lib/db/schema.ts — entidades principales

gyms              id, name, slug (único, para URL pública QR), timezone,
                  address (text)?, phone (text)?, email (text)?,
                  opening_hours (text)?,  -- persiste texto libre, ej. "Lun–Vie 7–22 / Sáb 8–20"
                  created_at

gym_settings      gym_id (FK), allow_over_limit (boolean default false),
                  low_credits_threshold (default 2), updated_at

profiles          id (= auth.users.id), role ('superadmin' | 'gym_admin' | 'member'),
                  full_name, created_at

gym_admins        id, gym_id (FK), user_id (FK profiles) — asignación admin ↔ gym

members           id, gym_id (FK), document_number (normalizado), full_name,
                  phone?, email?, birth_date (date)?, joined_at (date),
                  user_id? (FK profiles, null si no usa portal),
                  active, created_at

membership_plans  id, gym_id (FK), name,
                  plan_type ('credits' | 'unlimited'),
                  price_ars (integer centavos),
                  credits_per_month (integer, null si plan_type = 'unlimited'),
                  active, description?, created_at

enrollments       id, gym_id (FK), member_id (FK), plan_id (FK),
                  started_at, ended_at?, active

visits            id, gym_id (FK), member_id (FK), visited_at (timestamptz),
                  channel ('fichaje_admin' | 'fichaje_public' | 'staff_manual'),
                  over_limit (boolean default false), recorded_by? (FK profiles),
                  created_at

payment_records   id, gym_id (FK), member_id (FK), enrollment_id? (FK),
                  amount_ars (integer centavos), currency ('ARS'),
                  period_start, period_end, status ('paid' | 'pending' | 'overdue'),
                  paid_at?, notes?,
                  -- campos nulos reservados para Stripe:
                  provider?, provider_subscription_id?, provider_invoice_id?,
                  created_at

credit_adjustments  id, gym_id (FK), member_id (FK),
                    amount (integer, positivo o negativo),  -- +1 crédito a favor, -1 en contra
                    date (date),  -- fecha del ingreso no fichado o ajuste
                    recorded_by (FK profiles), notes (text)?, created_at
```

**Índices críticos:** `visits(gym_id, member_id, visited_at)`, `members(gym_id, document_number)`, `enrollments(gym_id, member_id, active)`.

---

## RBAC — middleware.ts

```
/login                     → público
/g/[slug]                  → público (fichaje por QR)
/superadmin/**             → requiere role = 'superadmin'
/admin/**                  → requiere role = 'gym_admin' + active_gym_id resuelto
/portal/**                 → requiere role = 'member'
```

El middleware lee la sesión de Supabase, verifica el rol y (para admins) que `active_gym_id` sea un gym asignado al usuario. Si el admin tiene un solo gym asignado, se fija automáticamente sin mostrar el selector.

**Scope MVP del Superadmin:** el superadmin solo accede a `/superadmin/**` (lista de gyms, lista de admins, crear/asociar). No tiene panel de gym activo ni acceso a rutas `/admin/**`. La impersonación o vista operativa cruzada queda pospuesta para versiones futuras.

---

## Políticas RLS (Supabase)

Cada tabla con `gym_id` tiene políticas que combinan:
1. **Rol del usuario** (via `auth.jwt() -> role`)
2. **Gym asignado** (join con `gym_admins` o verificación de `active_gym_id`)

Los admins solo pueden leer/escribir filas donde `gym_id` coincide con un gym que tienen asignado. Los miembros solo leen sus propias filas. El Superadmin tiene acceso irrestricto de lectura; escritura también con restricciones para no romper integridad.

---

## Convenciones y ajustes pendientes

### Idioma del código
**Todo el código está en inglés** — nombres de archivos, directorios, variables, funciones, componentes. El único texto en español son los strings visibles para el usuario en pantalla. ✅ (renombrado completado en Franja 1)

---

### Middleware — convención de archivo

En esta versión de Next.js la convención `middleware.ts` está **deprecada**. El archivo debe llamarse **`proxy.ts`** y exportar la función como **`export function proxy(...)`** (no `middleware`). El `export const config` con el `matcher` sigue igual.

> Referencia: advertencia en runtime — "The 'middleware' file convention is deprecated. Please use 'proxy' instead."

---

### Fichaje — búsqueda por nombre además de DNI
En la página de check-in (`/admin/check-in`), el admin debe poder buscar al socio por **nombre completo O número de documento**. Aplica tanto a la superficie de recepción (admin) como solo por DNI en la web pública por QR (sin nombre, para no exponer datos).

Impacto en Franja 4:
- El formulario de check-in en el panel admin tiene **un único campo de búsqueda** que acepta DNI o nombre
- La función `validateFichaje` recibe un campo `query` (string) y busca en `document_number` (exacto) o `full_name` (búsqueda parcial insensible a mayúsculas)
- Si la búsqueda por nombre retorna **más de un resultado**, mostrar lista para que el admin elija antes de registrar el ingreso
- La web pública por QR sigue siendo **solo por DNI** (sin exponer búsqueda por nombre a usuarios no autenticados)

---

## Franjas verticales

### Franja 1 — Autenticación y arranque multi-inquilino ✅

**Entregable:** login funcional, Superadmin puede crear gimnasios y administradores, Admin puede entrar al panel con gym activo seleccionado.

**Tareas:**
- [x] `npx create-next-app gym-flow --typescript --tailwind --app`
- [x] Instalar dependencias: `@supabase/supabase-js`, `@supabase/ssr`, `drizzle-orm`, `postgres`, `drizzle-kit`
- [x] shadcn/ui v4 inicializado (usa `@base-ui/react`, sin `asChild` — usar `render` prop o `buttonVariants` como className)
- [x] Crear proyecto en Supabase; configurar `.env.local`
- [x] Escribir `lib/db/schema.ts` — 9 tablas completas (todas las franjas pre-definidas)
- [x] Migración generada (`lib/db/migrations/0000_violet_lockheed.sql`) y aplicada en Supabase con RLS habilitado
- [x] `lib/supabase/server.ts`, `client.ts`, `admin.ts` — clientes Supabase
- [x] `lib/auth/roles.ts` — constantes de rol, cookie `gym-flow-active-gym`, ROLE_HOME
- [x] `middleware.ts` — RBAC por rol + cookie gym activo
- [x] Página de login (`app/(auth)/login/`) con Server Action
- [x] Layout Superadmin + navbar
- [x] Página `/superadmin/gimnasios` — tabla + dialog "Crear gimnasio"
- [x] Página `/superadmin/administradores` — tabla + dialog "Crear administrador" (crea user en Supabase Auth con `app_metadata.role`)
- [x] Selector de gym activo (`/admin/seleccionar-gym`) — guarda en cookie
- [x] Layout admin + navbar con gym activo + "Cambiar gimnasio"
- [x] Dashboard admin placeholder (`/admin/dashboard`)
- [x] Supabase configurado; migraciones 0000 y 0001 aplicadas en Supabase SQL editor
- [ ] **Pendiente:** crear usuario Superadmin en Supabase y probar flujo completo end-to-end

**Notas de implementación:**
- `drizzle-kit generate` requiere TTY interactivo para resolver conflictos de enum; ante cambios de enum escribir el SQL de migración manualmente.
- `drizzle-kit migrate` falla con conexión directa a Supabase (SSL/timeout). Solución: aplicar SQL en el editor de Supabase directamente. Para futuras migraciones: mismo proceso.
- Password con `$` en DATABASE_URL debe URL-encodearse como `%24`
- El rol del usuario se guarda en `user.app_metadata.role` (via `supabase.auth.admin.createUser` con `app_metadata`)

**Criterio de aceptación:**
- Superadmin crea gym "CrossFit Palermo", asigna admin "juan@ejemplo.com"
- Juan inicia sesión → ve selector si tiene varios gyms → entra al dashboard (vacío por ahora)

---

### Franja 2 — Socios en panel admin (tabla operativa) ✅

**Entregable:** Admin puede crear, buscar y ver socios del gym activo; columna "Créditos disponibles" visible.

**Tareas:**
- [x] Migración: tablas `members`, `membership_plans`, `enrollments`, `credit_adjustments` (0001 aplicada)
- [x] Página `/admin/members` — tabla paginada con búsqueda por nombre completo o número de documento
- [x] Columnas de la tabla: nombre completo, teléfono, fecha de nacimiento, fecha de alta, último fichaje, plan, créditos restantes (∞ si unlimited), estado de pago del mes, acciones
- [x] Filtro por estado: activos / inactivos / todos
- [x] Formulario crear socio (nombre, documento, teléfono, email, fecha de nacimiento, fecha de alta)
- [x] Formulario editar socio (mismos campos + toggle activo/inactivo)
- [x] Eliminar socio (soft delete — marca `active = 'false'`)
- [x] Menú de acciones por fila: Ver detalle / Editar / Eliminar
- [x] Página de detalle `/admin/members/[id]`: datos personales, membresía activa con créditos del mes, historial de fichajes (últimos 30), historial de pagos (últimos 12)
- [x] UI de ajuste manual de créditos en detalle: campo cantidad (+/-), fecha, nota → `credit_adjustments`
- [x] Columna "Créditos disponibles": visitas + ajustes del mes; "∞" para plan unlimited
- [x] Helper `lib/domain/credits.ts`: maneja `unlimited` (retorna `Infinity`) y suma `credit_adjustments`
- [ ] **Pendiente:** RLS para `credit_adjustments` en Supabase
- [ ] **Pendiente:** Al crear socio con email → crear usuario en Supabase Auth (`role = 'member'`, password = documento) para acceso al portal — diferido a Franja 3 junto con el portal

**Lógica de créditos implementada:**
```
si plan_type = 'unlimited' → retornar Infinity

ventana = [inicio del mes calendario en TZ del gym, hoy]
visitas_en_ventana = COUNT(visits WHERE member_id AND gym_id AND visited_at IN ventana AND NOT over_limit)
ajustes_en_ventana = SUM(credit_adjustments WHERE member_id AND gym_id AND date IN ventana)
créditos_disponibles = plan.credits_per_month - visitas_en_ventana + ajustes_en_ventana
```

**Archivos creados/modificados:**
- `app/admin/(protected)/members/page.tsx`
- `app/admin/(protected)/members/actions.ts`
- `app/admin/(protected)/members/_components/create-member-dialog.tsx`
- `app/admin/(protected)/members/_components/edit-member-dialog.tsx`
- `app/admin/(protected)/members/_components/member-actions-menu.tsx`
- `app/admin/(protected)/members/[id]/page.tsx`
- `app/admin/(protected)/members/[id]/_components/credit-adjustment-form.tsx`
- `lib/domain/credits.ts`

---

### Franja 3 — Planes e inscripciones ✅

**Entregable:** Admin gestiona planes del gym; puede inscribir socios en planes; portal del socio muestra plan y créditos.

**Tareas:**
- [x] Página `/admin/plans` — CRUD de planes (nombre, tipo, precio ARS, créditos/mes, activo)
- [x] Tipo de plan: selector `credits` / `unlimited`; si `unlimited`, ocultar campo créditos/mes
- [x] `formatARS(centavos)` en `lib/utils.ts`; `pesosTocentavos` helper
- [x] Formulario inscribir socio en plan (`enrollments`) desde detalle del socio — botón "Inscribir en plan" / "Cambiar plan"
- [x] Validación: deactiva inscripción activa previa antes de crear la nueva (una inscripción activa a la vez por socio)
- [x] Plan e inscripción activa visible en la tabla de socios (ya estaba en Franja 2)
- [x] Ruta `/portal/account` (auth requerida para `member`): perfil de solo lectura — nombre, email, teléfono, nacimiento, alta, último fichaje, plan, créditos, estado de pago
- [x] Al crear socio con email: crea usuario Supabase Auth (`role = 'member'`, password = documento) y perfil en `profiles`

**Archivos creados/modificados:**
- `lib/utils.ts` — `formatARS`, `pesosTocentavos`
- `app/admin/(protected)/plans/page.tsx`
- `app/admin/(protected)/plans/actions.ts` — plans CRUD + `enrollMemberAction`
- `app/admin/(protected)/plans/_components/create-plan-dialog.tsx`
- `app/admin/(protected)/plans/_components/edit-plan-dialog.tsx`
- `app/admin/(protected)/plans/_components/plan-actions-menu.tsx`
- `app/admin/(protected)/members/[id]/_components/enroll-member-dialog.tsx`
- `app/admin/(protected)/members/[id]/page.tsx` — agrega `EnrollMemberDialog` + consulta planes activos
- `app/admin/(protected)/members/actions.ts` — crea Auth user + profile al crear socio con email
- `app/portal/layout.tsx`
- `app/portal/account/page.tsx`

**Criterio de aceptación:**
- Plan "Mensual estándar" — $30.000 ARS, 12 créditos/mes → socio ve 12 créditos disponibles al inicio del mes
- Plan "Libre" — sin límite de créditos → socio ve "Plan libre / Acceso ilimitado"
- Socio puede iniciar sesión con su email y contraseña = número de documento

---

### Franja 4 — Fichaje + Configuración + QR del gym ✅

**Entregable:** Fichaje funcional en recepción y vía QR público; regla 1 visita/día; configuración de exceso.

**Tareas:**

**Configuración del gym:**
- [x] Migración: tabla `gym_settings` ya existía; `address`, `phone`, `email`, `opening_hours` ya en `gyms`
- [x] Página `/admin/settings` — dos secciones: información del gym + configuración operativa
- [x] Server Action guardar información del gym (actualiza tabla `gyms`)
- [x] Server Action guardar configuración operativa (actualiza tabla `gym_settings`)

**Lógica de fichaje (`lib/domain/fichaje.ts`):**
- [x] `validateFichaje(query, gymId, gymTimezone, channel)` — todos los estados implementados
- [x] `validateMemberFichaje(member, gymId, gymTimezone)` — validación para miembro específico
- [x] `recordVisit(memberId, gymId, channel, overLimit, recordedBy?)` — crea la fila `Visit`

**Superficie 1 — Panel recepción:**
- [x] Página `/admin/check-in` — campo de búsqueda único (DNI o nombre)
- [x] Flujo: buscar → ver estado + créditos → confirmar → resultado grande y legible
- [x] Manejo de múltiples coincidencias: lista para que el admin elija
- [x] Tres Server Actions: `searchFichajeAction`, `validateMemberFichajeAction`, `registerFichajeAction`

**Superficie 2 — Web pública QR:**
- [x] Campo `slug` ya existía en `gyms` (generado al crear gym)
- [x] Página `/g/[slug]` — solo DNI, sin autenticación
- [x] Server Action pública `publicFichajeAction(slug, documentNumber)`
- [x] Página `/admin/settings` — QR imprimible + botón "Imprimir" + "Copiar enlace"
- [ ] **Pendiente:** Rate limiting por IP (middleware o Vercel Edge Config)

**Archivos creados:**
- `lib/domain/fichaje.ts`
- `app/admin/(protected)/check-in/page.tsx`
- `app/admin/(protected)/check-in/actions.ts`
- `app/admin/(protected)/check-in/_components/check-in-client.tsx`
- `app/admin/(protected)/settings/page.tsx`
- `app/admin/(protected)/settings/actions.ts`
- `app/admin/(protected)/settings/_components/gym-info-form.tsx`
- `app/admin/(protected)/settings/_components/operational-settings-form.tsx`
- `app/admin/(protected)/settings/_components/gym-qr.tsx`
- `app/g/[slug]/page.tsx`
- `app/g/[slug]/actions.ts`
- `app/g/[slug]/_components/public-check-in-form.tsx`

**Criterio de aceptación:**
- Socio con plan `credits` y 0 créditos: se deniega o se permite con advertencia visible según `allow_over_limit`
- Socio con plan `unlimited`: siempre se aprueba el fichaje sin verificar créditos
- Segundo intento el mismo día: "Ya registramos tu ingreso hoy" — no crea segunda visita
- QR del gym abre formulario en mobile, socio puede fichar sin app ni login

---

### Franja 5 — Dashboard del admin (inicio) ✅

**Entregable:** Página de inicio del admin muestra KPIs operativos del gym activo.

**Tareas:**
- [x] Página `/admin/dashboard` (ruta índice del admin)
- [x] KPIs operativos (tarjetas numéricas):
  - Socios activos
  - Ficharon este mes (con % de socios activos como sublabel)
  - Ficharon esta semana (con % de socios activos como sublabel)
  - Recaudado este mes (monto ARS — sum de `payment_records` pagados del período)
  - Por cobrar (monto ARS — sum de `payment_records` pendientes/vencidos del período)
  - Socios con 0 créditos (sublabel: cantidad con ≤ `low_credits_threshold`)
- [x] Dos tablas de socios sin pago este mes (máx. 10 cada una, clickeables → detalle):
  - **"Sin pago — siguen viniendo"**: vinieron este mes, solo necesitan pagar (acción: recordarles)
  - **"Sin pago — no vinieron este mes"**: posible churn; mostrar última visita para evaluar si contactar o desactivar
- [x] Gráfico de torta: socios que pagaron vs no pagaron en el mes actual (con labels de cantidad)
- [x] Gráfico de área: cantidad de socios únicos que ficharon al menos 1 vez por mes (últimos 12 meses)
- [x] Todas las queries filtradas por `gym_id` del gym activo
- [x] Agregados calculados en servidor; datos enviados al cliente como arrays `[label, value]` (no datos crudos)
- [x] Librería de gráficos: Recharts (client component wrapper sobre Server Component)

**Archivos creados/modificados:**
- `lib/domain/dashboard.ts` — `getKpis`, `getUnpaidMembers`, `getVisitsChartData`
- `app/admin/(protected)/dashboard/page.tsx` — dashboard completo
- `app/admin/(protected)/dashboard/_components/payment-bar-chart.tsx` — pie chart (Recharts PieChart)
- `app/admin/(protected)/dashboard/_components/visits-area-chart.tsx`

**Criterio de aceptación:**
- Dashboard muestra tarjetas con valores correctos para socios activos, fichajes con porcentaje y montos del mes
- Gráfico de torta refleja cuántos socios pagaron vs no pagaron en el mes
- Gráfico de área muestra tendencia histórica de asistencia mensual (últimos 12 meses)
- Admin puede hacer click en un socio de la lista crítica y va a su detalle

---

### Franja 6 — Libro de pagos ✅

**Entregable:** Admin registra pagos manualmente; puede filtrar socios morosos; socio ve su estado en el portal.

**Tareas:**
- [x] Migración: tabla `payment_records` ya aplicada en migración 0000
- [x] Página `/admin/payments` — tabla con filtros: estado (pagado/pendiente/vencido), período (mes)
- [x] Formulario registrar pago manual para un socio (con auto-fill del monto desde el plan)
- [x] Marcar pago como vencido (manual por fila o bulk con "Marcar vencidos")
- [x] Vista de socio individual: historial de pagos (ya estaba en Franja 2/3)
- [x] Portal del socio: sección "Mis pagos" (ya estaba en Franja 3)

**Archivos creados:**
- `app/admin/(protected)/payments/page.tsx`
- `app/admin/(protected)/payments/actions.ts` — `registerPaymentAction`, `updatePaymentStatusAction`, `markOverdueAction`, `deletePaymentAction`
- `app/admin/(protected)/payments/_components/register-payment-dialog.tsx`
- `app/admin/(protected)/payments/_components/payment-row-actions.tsx`
- `app/admin/(protected)/payments/_components/mark-overdue-button.tsx`

**Criterio de aceptación:**
- Admin registra pago de $30.000 ARS para socio → aparece en historial
- Filtro "morosos" lista socios con pagos vencidos

---

### Ajustes post-Franja 6 ✅

**Mejoras incrementales aplicadas sobre franjas anteriores.**

- [x] Página `/admin/members`: filtro de "Estado" (activos/inactivos/todos) convertido a dropdown; agregado segundo dropdown "Cuota" (todas/al día/pendiente/vencida) — filtro aplicado con `EXISTS` a nivel SQL, compatible con paginación
- [x] Página `/admin/members`: URL params: `?status=`, `?payment=`, `?q=`, `?page=`

**Archivos modificados:**
- `app/admin/(protected)/members/page.tsx`

---

### Franja 7 — Analíticas v1

**Entregable:** Admin ve tendencias del gym activo con agregados SQL (sin enviar datos crudos al browser).

**Tareas:**
- [ ] Página `/admin/analiticas`
- [ ] Gráfico: visitas por día (últimos 30 días) — usando timezone del gym
- [ ] Gráfico: visitas por hora del día (mapa de calor semanal)
- [ ] Gráfico: tendencia de pagos por mes (monto cobrado vs pendiente)
- [ ] Todos los gráficos: datos calculados en servidor, enviados como arrays de `[label, value]`
- [ ] Librería de gráficos: Recharts (compatible con React Server Components via client wrapper)

**Criterio de aceptación:**
- Gráfico de visitas respeta la timezone del gym (medianoche local, no UTC)
- Datos no exponen IDs ni información sensible de otros gyms

---

## Convenciones de código

- **Nombres técnicos en inglés** (BD, API, componentes), **textos de UI en español**
- Montos en BD: `integer` (centavos); en UI: `formatARS(centavos: number)` → `"$ 30.000"` — helper en `lib/utils.ts`
- Todos los Server Actions validan `gym_id` contra la sesión antes de cualquier operación
- Errores de negocio: objetos tipados `{ error: string }`, no excepciones
- Sin contadores denormalizados hasta que haya evidencia de necesidad de performance
- **Base UI (shadcn v4):** usar `onClick` en `DropdownMenuItem`, **no** `onSelect` (es Radix UI y se ignora silenciosamente)
- **Base UI Select:** `onValueChange` recibe `string | null` — manejar siempre con `?? defaultValue`
- **Base UI DropdownMenuTrigger:** no soporta `asChild` — pasar `className` directo con `buttonVariants`
- `active` en `members`, `membership_plans`, `enrollments` es `text` `'true'`/`'false'`, no boolean (decisión de esquema inicial)

---

## Variables de entorno necesarias

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # solo en servidor, nunca en cliente
DATABASE_URL=                   # string de conexión Postgres para Drizzle
```

---

## Orden de trabajo sugerido por sesión con IA

Cada sesión de implementación debería incluir:
1. **Franja activa + archivo(s) permitidos** — ej. "implementamos `lib/domain/fichaje.ts` y la Server Action de `/admin/fichaje`"
2. **IDs de requisito** — referencias a `DR-xx` o `FR-xx` del PROJECT.md cuando los specs los definan
3. **Sin creep de alcance** — si algo no está en esta franja, se anota en `## Futuras mejoras` del PROJECT.md

---

## Estado

| Franja | Estado |
|--------|--------|
| 1 — Auth + multi-tenant | 🟡 código completo · migraciones aplicadas · pendiente test e2e + crear superadmin |
| 2 — Socios + tabla | ✅ completo · pendiente RLS credit_adjustments |
| 3 — Planes + inscripciones | ✅ completo |
| 4 — Fichaje + QR | ✅ completo · pendiente rate limiting por IP |
| 5 — Dashboard | ✅ completo |
| 6 — Libro de pagos | ✅ completo |
| Ajustes post-F6 | ✅ completo |
| 7 — Analíticas | ⬜ pendiente |

---

## Notas de setup

### Crear usuario Superadmin (una sola vez)
1. Ir a Supabase Dashboard → Authentication → Users → Add user
2. Completar email y contraseña
3. En el SQL Editor de Supabase ejecutar:
```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "superadmin"}'::jsonb
WHERE email = 'tu-email@ejemplo.com';
```

### Migraciones futuras
`drizzle-kit migrate` falla con Supabase directo (SSL). Proceso para nuevas migraciones:
1. `npx drizzle-kit generate` → genera el SQL en `lib/db/migrations/`
2. Copiar el SQL generado al editor de Supabase y ejecutarlo con "Run and enable RLS"
