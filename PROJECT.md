# Gym-flow — plan del proyecto

**Estado:** planificación (sin implementación iniciada)  
**Propósito:** aplicación web multi-inquilino para operación de gimnasios, con especificaciones redactadas para que el desarrollo asistido por IA pueda implementarse en **franjas verticales** claras.

Este documento es la **fuente única de verdad** sobre la dirección del producto hasta que separés especificaciones de API/UI. Refiná las secciones hasta estar conforme; después cerrá el alcance del v1 y empezá especificaciones por franja.

---

## 1. Visión y problema

**Producto:** aplicación web para gestionar gimnasios en un sistema **multi-inquilino**: conviven varios gimnasios en un mismo despliegue; el **Superadministrador** ve todos los gimnasios, crea gimnasios y administradores, y puede dar de alta **socios**; los **administradores de gimnasio** trabajan en un contexto de **gimnasio activo** (selector + cambio en la barra), gestionan planes/socios, **Fichaje** (ingreso por documento), **QR estable por gimnasio** para uso sin recepción, **dashboard** operativo y tabla de socios con **créditos disponibles**; los **socios** pueden usar el **portal** para consultar plan/pagos y otros flujos opcionales, pero el **ingreso físico en el v1 se centra en el Fichaje por DNI** (§11).

**Problemas que resolvemos (para quien administra el gym):**

- Sin herramienta, los socios **olvidan pagar** la cuota.
- Pueden **asistir más veces de las que el plan permite**, y eso es difícil de controlar.

**Resultado:** mejor control operativo mediante **asistencia registrada**, **visibilidad de membresías/pagos** y **analíticas para administradores** (cobranzas, días pico, etc.).

---

## 2. Decisiones de alcance (bloqueadas para planificar el v1)

Estas decisiones guían la arquitectura y las especificaciones; cambialas primero aquí y después propagalas a documentos hijos.

| Tema | Decisión |
|--------|----------|
| **Ingreso al gym (v1)** | **Fichaje:** formulario por **número de documento** (DNI u otro identificador definido en las specs). Dos superficies: **(1)** página **Fichaje** en el panel de administración (recepción); **(2)** **misma experiencia** en una **página web pública**, accesible al escanear un **QR estable por gimnasio** (URL firmada / slug único por gym). Respuesta inmediata en pantalla: **si puede pasar o no**, **créditos restantes**, mensajes por falta de pago / sin créditos / modo advertencia según **Configuración**. **Regla:** como máximo **un ingreso fichado por socio por gym por día natural** (según **huso horario del gym**). Ver §11. |
| Portal de socio | El socio **logueado** ve solo sus datos — **plan**, **créditos**, estado de pagos — útil para autogestión; **no es obligatorio** para fichar en la puerta si el flujo público por DNI está activo (menos fricción cuando no hay recepción). |
| Pagos (MVP) | **Libro manual** (montos, períodos, pagado/vencido). **Diseño preparado para Stripe más adelante** (mismo lenguaje de dominio, `PaymentRecord` extensible). |
| Multi-inquilinato | **Valor por defecto recomendado:** una base **Postgres**, **aislamiento por `gym_id`** (capa de aplicación y/o seguridad a nivel de filas). Menos operación que esquema o base por inquilino en esta etapa. |
| **Idioma y moneda** | **Interfaz:** español (Argentina) — textos, etiquetas, mensajes, validaciones. **Dinero:** pesos argentinos (**ARS**); el formato en pantalla sigue convención local (p. ej. `$ 30.000` en las specs — confirmar separadores en guía de UI). Guardar montos en tipo numérico adecuado para dinero (evitar punto flotante); persistir código ISO **`ARS`** junto al monto para que los informes sigan siendo claros si algún día hay multi-moneda. |

---

## 3. Personas y responsabilidades generales

| Persona | Responsabilidad |
|---------|----------------|
| **Superadministrador** | Alcance de **plataforma** (MVP): **ver todos los gimnasios**, **crear gimnasios**, **crear administradores de gimnasio**, asignar administradores ↔ gimnasios. **No** tiene panel de gym activo ni acceso a operaciones del gym (socios, fichaje, planes) — esas pantallas son exclusivas del admin de gymnasio. La impersonación o vista operativa cruzada queda pospuesta para versiones futuras. |
| **Administrador de gimnasio** | Tras iniciar sesión: si tiene **un solo gimnasio asignado**, va directamente al dashboard de ese gym. Si tiene **varios**, debe elegir uno; la **barra de navegación** permite cambiar el gym activo. Navbar: Dashboard, Socios, Planes, Fichaje, y menú de usuario (Perfil / Configuración del gym / Cerrar sesión). Para el gym activo: CRUD de socios/planes/inscripciones, **Fichaje**, **QR imprimible**, pagos, **Configuración**, **dashboard** operativo, analíticas. **No puede** crear gimnasios ni gestionar otros administradores. |
| **Socio** | **Portal de solo lectura** (v1): ve su perfil, plan, créditos restantes y estado de pago. Login con email; contraseña inicial = número de documento. **Ingreso físico** mediante **Fichaje por DNI** (recepción o QR) sin necesidad de estar logueado en el portal. No accede a datos de administración. |

---

## 4. Flujo de trabajo especificación + IA

Entregar el trabajo en **paquetes de especificación acotados** para que la implementación no se desborde.

**Pila de documentos (conjunto vivo; no hace falta un solo archivo gigante):**

1. **Resumen de producto** — dolor, personas, anti-objetivos del v1 (cuando existan), métricas de éxito (p. ej. “el admin encuentra socios morosos en menos de 30 segundos”).
2. **Glosario** — nombres estables (ver sugerencias §7); los **textos de UI en español** pueden vivir en hojas de copy vinculadas a IDs de requisito cuando ayude.
3. **Multi-inquilinato y RBAC** — quién puede leer/escribir qué; cómo se resuelve `gym_id` en cada solicitud (§5).
4. **Reglas de dominio** — invariantes numeradas (`DR-xx`): inscripciones, visitas, créditos por ventana de facturación, comportamiento ante exceso según Configuración.
5. **Contrato de API** — OpenAPI (o equivalente) por franja vertical; errores; autenticación.
6. **Estados de UI** — carga / vacío / error / prohibido por pantalla (mensajes en español).
7. **Escenarios de aceptación** — Dado / Cuando / Entonces, ligados a IDs de requisito (`FR-xx`, `DR-xx`).

**Al pedirle a la IA que implemente:** una franja vertical + citar IDs de requisito + listar archivos permitidos → menos deriva de alcance.

---

## 5. RBAC (control de acceso)

### Qué es el RBAC

**RBAC** (*Role-Based Access Control*) es el **control de acceso basado en roles**. En lugar de asignar permisos usuario por usuario, cada usuario tiene un **rol** (aquí: Superadministrador, Administrador de gimnasio o socio en el **portal**). Cada rol trae un conjunto de **capacidades**: qué puede ver y hacer en el sistema.

Por qué importa en gym-flow:

- **Seguridad:** un administrador de gimnasio no debe leer ni modificar datos de otro gym por error o mala fe; las reglas deben aplicarse siempre igual (middleware + límites en base de datos).
- **Claridad:** las specs y pruebas pueden decir “el administrador de gimnasio **no** puede crear gimnasios” en lugar de “algunos usuarios…”.
- **Código asistido por IA:** matrices explícitas reducen endpoints inventados o interfaces que filtran datos entre inquilinos.

El RBAC **no reemplaza** el **aislamiento por inquilino**: aunque el rol sea correcto, cada acción del administrador de gimnasio debe limitarse a los gimnasios asignados (`gym_id` + comprobaciones de membresía).

### Administrador de gimnasio — gym activo (UX multi-sede)

- Tras autenticarse, si el admin tiene **más de un gym asignado**, **debe elegir uno** antes de entrar al **panel del gimnasio** (rutas bloqueadas hasta fijar `active_gym_id`).
- La **barra de navegación** incluye **cambiar de gimnasio**: actualiza el gym activo y recarga panel/datos para que cada pantalla admin quede **acotada al gym seleccionado**.
- Las peticiones desde la UI de administración envían **`gym_id`** (o se deducen de la **sesión del gym activo**) y el servidor verifica la asignación.

El **Superadministrador** **no** necesita ese selector para tareas rutinarias de plataforma (crear gym, crear admin, crear socio con gym elegido); un **panel global** opcional queda para más adelante.

### Matriz de capacidades (intención del v1)

| Capacidad | Superadministrador | Administrador de gimnasio | Socio (portal) |
|-----------|-------------------|-------------------------|----------------|
| Ver / CRUD de gimnasios | Sí | No | No |
| Crear, invitar, deshabilitar cuentas de **administrador de gimnasio** | Sí | No | No |
| Asignar administrador ↔ gimnasios | Sí | No | No |
| CRUD de **socios** | Sí — siempre **acotado al gym elegido** al crear/editar | Sí — **solo gimnasios asignados** (vía gym activo) | No |
| Gestionar **otros administradores** | Sí | **No** | No |
| **CRUD de planes de membresía** | No | Sí (gym asignado activo) — los planes **pertenecen al gym**; tipo `credits` (con límite mensual) o `unlimited` (sin restricción de visitas) | No |
| Editar **Configuración del gym** | No | Sí (gym asignado activo) — info del gym (nombre, dirección, teléfono, email, horarios) + config operativa (`allow_over_limit`, umbral de créditos bajos) | No |
| **Fichaje / visitas** | No (MVP) | **Página Fichaje** (búsqueda por DNI o nombre → resultado visual grande); **QR estable** del gym para fichaje público; **ajustes manuales de créditos** (`credit_adjustments`) con auditoría | Abrir URL del QR del gym → formulario solo DNI (sin login); portal de solo lectura |
| Libro de pagos | Auditoría opcional | Sí (gym asignado activo) | Solo su propio estado |
| Dashboards / agregados | Resumen opcional multi-gym | **Gym activo** | Solo su propio resumen |

El Superadministrador cubre **incorporación a la plataforma** (gimnasios, administradores, socios); la **operación diaria del gym** (planes, **Fichaje**, QR estable, socios del lugar) corresponde a los administradores de gimnasio **para sus sedes asignadas**.

**Detalle de especificación:** al crear un socio, el formulario/API **exige `gym_id`** (sin socios huérfanos).

---

## 6. Planes de membresía (nivel gym)

**Decisión:** `MembershipPlan` pertenece a **un solo gym** y lo **crean y editan los administradores de gimnasio** de los gimnasios que gestionan (sin plantillas globales del Superadministrador).

Campos sugeridos para las specs (nombres exactos en glosario/OpenAPI):

- **Tipo de plan** (`plan_type`): `credits` (con límite de visitas mensual) o `unlimited` (acceso ilimitado, sin conteo de créditos).
- **Precio** por período de facturación — monto en **ARS** en el MVP.
- **Créditos por mes** — solo aplica si `plan_type = 'credits'`; máximo de **Visitas** permitidas en cada ventana mensual (p. ej. **12 créditos/mes** ≈ tres visitas por semana). Null si `unlimited`.
- Metadatos habituales: nombre, activo/archivado, descripción opcional.

**Ejemplos (documentación):**
- Plan `credits`: **$30.000 ARS / mes**, **12 créditos/mes** (tres visitas por semana).
- Plan `unlimited`: **$50.000 ARS / mes**, sin tope de visitas.

La implementación debe guardar monto numérico + `ARS`, no solo texto libre.

Las **inscripciones** vinculan un **socio** a un **MembershipPlan** bajo ese gym; los créditos restantes del período se derivan de filas **`Visit`** más ajustes en **`CreditAdjustment`** (y contadores en caché solo si las specs lo permiten).

---

## 7. Nombres sugeridos (código + UI en español)

En código API/base de datos conviene un identificador estable (a menudo en inglés) para herramientas habituales; en la **interfaz** se muestra **español**.

| Nombre técnico (API / BD) | Etiqueta en UI (sugerencia) |
|---------------------------|-----------------------------|
| `Gym` | Gimnasio / Sede |
| **Fichaje** (funcionalidad / ruta) | Fichaje / Ingreso |
| `MembershipPlan` | Plan / Plan de membresía |
| `Enrollment` | Inscripción / Membresía activa |
| `Visit` | Visita / Ingreso |
| `PaymentRecord` | Pago / Registro de pago |
| `ClientProfile` o `Member` | Socio / Cliente (elegí uno — **Socio** encaja con el lenguaje de gimnasio en Argentina) |

Si preferís **Member** en código en lugar de `ClientProfile`, dejalo fijado en el glosario; evitá mezclar “Client” y “Member” sin definición.

---

## 8. Configuración del gym — visitas por encima del límite

**Decisión:** hay un área de **Configuración** por gym (solo administrador de gimnasio, gimnasios asignados).

Para el caso **”el socio ya no tiene créditos”**, los administradores definen el comportamiento mediante un toggle simple:

- **`allow_over_limit = false` (default):** se deniega el ingreso. El sistema muestra un mensaje claro en recepción.
- **`allow_over_limit = true`:** el socio puede fichar igual; el sistema crea la Visit con `over_limit = true` y muestra una advertencia en recepción. El dashboard del admin muestra cuántos socios están usando esta gracia para facilitar el seguimiento.

Los planes con `plan_type = 'unlimited'` ignoran esta configuración — siempre se aprueba el fichaje.

Otros valores a nivel gym (huso horario, **umbral de “cerca de cero créditos” para el dashboard**, marca visual más adelante) pueden convivir en la misma página de Configuración.

---

## 9. Núcleo del dominio (esbozo de entidades del MVP)

| Concepto | Rol |
|----------|-----|
| **Gym** | Límite de inquilino; huso horario; **Configuración** incluyendo política ante exceso de visitas. |
| **User** | Identidad de login; se vincula a Superadministrador / Administrador de gimnasio / Socio mediante asignaciones o perfiles. |
| **ClientProfile** (o **Member**) | Persona que entrena; puede asociarse 1:1 a `User` para login en el portal. |
| **MembershipPlan** | Pertenece al **gym**; **precio ARS**; **créditos mensuales** (tope de visitas por ventana); lo define el administrador de gimnasio. |
| **Enrollment** | Vínculo activo: socio + gym + plan + semántica de período; el conteo de visitas sale de filas **`Visit`** salvo que las specs agreguen contadores. |
| **Visit** | Marca de tiempo, gym, socio resuelto por documento; `recorded_by` opcional; canal **`fichaje_admin`** (panel recepción), **`fichaje_public`** (web tras QR sin sesión del socio), **`staff_manual`** (corrección en recepción); bandera **over_limit** cuando aplique Configuración. |
| **CreditAdjustment** | Ajuste manual de créditos por el admin (ej: el socio entró sin fichar). Campos: gym, socio, `amount` (entero positivo o negativo), fecha, admin que lo registró, nota opcional. Se suma al cálculo de créditos disponibles en la misma ventana mensual. Permite auditoría sin modificar filas `Visit`. |
| **PaymentRecord** | MVP: montos manuales **ARS**, período cubierto, estado; campos nulos preparados para proveedor Stripe. |

**Pendiente de detallar en la spec de dominio:**

- **Huso horario** para límites de “mes” y analíticas — siempre el del gym.
- **Un solo fichaje permitido por socio por gym por día natural** (segundo intento el mismo día → mensaje claro sin consumir crédito extra).
- Si se permiten **inscripciones solapadas** para un mismo socio en un mismo gym.

---

## 10. Franjas verticales (orden de construcción sugerido)

Cada franja entrega un incremento demostrable y su propio paquete de spec + borrador de pruebas de aceptación.

1. **Autenticación y arranque multi-inquilino** — Login; Superadministrador crea gimnasios; crea administradores de gimnasio; asigna gimnasios.
2. **Socios en panel admin — tabla operativa** — CRUD de socios; búsqueda; columna **Créditos disponibles** (período actual / plan activo — definición exacta en specs).
3. **Planes e inscripciones** — CRUD de planes (ARS + créditos/mes); inscripciones; portal de socio opcional con lectura de plan/créditos/pagos.
4. **Fichaje + Configuración + QR del gym** — Página **Fichaje** (admin); **web pública** vía QR estable; **Configuración** ante exceso de visitas; **1 visita/día/socio/gym**; registro **`staff_manual`** y ajustes auditados opcionales.
5. **Dashboard admin (inicio)** — Resumen del gym activo: **cantidad de socios con 0 créditos** y **cantidad con créditos ≤ umbral “cerca de cero”** (umbral **configurable en Configuración** o valor por defecto en specs, p. ej. ≤ 2).
6. **Libro de pagos** — Manual; filtros por morosidad; el socio ve su estado en el portal si existe.
7. **Analíticas v1** — Picos por hora/día, tendencias de pagos (huso horario del gym).

**Más adelante:** webhooks de Stripe → conciliación en `PaymentRecord`; el libro sigue siendo la verdad visible para administradores.

---

## 11. Fichaje (v1) — ingreso por documento + QR por gym

Es la **propuesta unificada del v1**: modelo mental simple para socios y flexibilidad para el gimnasio (**con o sin recepción**).

### Objetivos de UX

- **Cola rápida** en puerta o recepción.
- **Respuesta clara:** puede pasar / no puede pasar + **créditos disponibles** + mensajes de morosidad / sin créditos / advertencia (según §8).
- **Un fichaje exitoso → un `Visit` → los créditos siguen derivándose del mismo modelo de negocio.**

### Superficie 1 — “Fichaje” en el panel admin (recepción)

- Pantalla dedicada (nombre sugerido en UI: **Fichaje**).
- Formulario: **número de documento** del socio (normalizar formato DNI en specs).
- Al enviar: el servidor valida inscripción activa, pagos si aplican, créditos del período, reglas ante **exceso**, y **si ya fichó hoy** → crea **`Visit`** con canal **`fichaje_admin`** cuando corresponda y devuelve feedback para mostrar **grande y legible** en recepción.

### Superficie 2 — Web pública + QR estable por gimnasio

- Cada gym tiene **un QR imprimible** (idealmente con una **URL no adivinable**: slug/token por gym o firma larga) que lleva a **la misma experiencia de formulario por DNI**, sin login del socio.
- Flujo: escaneo → página web → ingresa documento → enviar → mismo tipo de respuesta que en recepción.
- Registrar **`Visit`** con canal **`fichaje_public`** cuando la validación sea exitosa.

### Regla de negocio clave — una vez por día

- **Como máximo un ingreso fichado por socio por gym por día natural**, usando el **huso horario del gym** para definir la medianoche.
- Segundo intento el mismo día: **mensaje explícito en UI** (p. ej. “Ya registramos tu ingreso hoy”) — **no** debe consumir otro crédito ni crear un segundo `Visit`, salvo decisión explícita contraria en las specs.

### Tabla de socios (admin)

- Columna visible **Créditos disponibles** (según período/plan actual — mismo cálculo que Fichaje) para identificar rápido **quién está al día vs quién debe pagar**.

### Dashboard — página principal del admin (gym activo)

- Bloques numéricos o lista corta: **socios con 0 créditos** y **socios “cerca de 0”** (p. ej. ≤ N créditos; **N configurable en Configuración** o valor por defecto documentado).
- Objetivo operativo: **anticiparse** antes de conflictos en la puerta por falta de créditos.

### Portal del socio (opcional en paralelo)

- El socio puede tener sesión para ver **plan / créditos / pagos** sin pasar por Fichaje; **no bloquea** el modelo sin recepción.

### Riesgos a cerrar en specs (`DR-xx`) — resumen

- **Abuso por DNI:** ✅ Rate limiting por IP implementado en `proxy.ts` con Upstash Redis — sliding window 10 req/10 s sobre `/g/*`. CAPTCHA y límite por documento quedan como mejoras futuras si se detecta abuso persistente.
- **Privacidad en dispositivo compartido:** no persistir DNI en historial donde se pueda evitar; avisos de “dispositivo público”.
- **Documento mal ingresado:** mensajes claros (“no encontramos un socio en este gimnasio”).

### Modalidades pospuestas respecto del v1

Ideas anteriores (QR diario solo para socios logueados, códigos rotativos personales, etc.) pueden volver como **refuerzo de seguridad** o redundancia; el **v1** se concentra en **Fichaje + QR estable + registro manual admin**.

---

## 12. Analíticas y dashboard (disciplina del MVP)

- **Inicio del dashboard** (§11): KPI operativos **créditos en cero / créditos bajos** por gym activo (consultas agregadas en servidor).
- Resto de analíticas: preferir **agregados en SQL** antes de enviar visitas crudas al navegador.
- Cada gráfico tiene un **contrato de consulta**: dimensiones, filtros, rango de fechas, **huso horario del gym**.
- Posponer vistas materializadas / jobs nocturnos hasta que el volumen lo exija — no son requisito del MVP.

---

## 13. Diseño listo para Stripe (sin Stripe en el MVP)

- `PaymentRecord` es la abstracción que ven administradores y socios.
- Reservar columnas nulas o metadatos para identificadores de suscripción/factura del proveedor.
- Documentar transiciones de estado futuras vía **webhook** aun antes de implementarlas.

---

## 14. Tecnología (opcional hasta que lo definan)

La pila sigue abierta; conviene decidirla antes de congelar OpenAPI.

- **Backend:** API HTTP tipada + Postgres; comprobaciones de inquilino en middleware **y** en BD (RLS o repositorios estrictos).
- **Frontend:** SPA o framework full-stack — según familiaridad del equipo.
- **Artefacto de contrato:** OpenAPI (o esquema RPC) como acuerdo entre cliente y servidor.

### Pila elegida

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16.2.5 (App Router, Turbopack) |
| Auth + Postgres | Supabase (RLS, `app_metadata.role`) |
| ORM | Drizzle ORM — schema en `lib/db/schema.ts` |
| UI | shadcn v4 con @base-ui/react (sin `asChild`) |
| Edge proxy / auth guard | `proxy.ts` (Next.js 16 — reemplaza `middleware.ts`) |
| Rate limiting | Upstash Redis + `@upstash/ratelimit` (sliding window) |
| Gráficos | Recharts 3 |
| Formularios | react-hook-form + zod |
| Moneda | ARS, enteros en centavos en BD |
| Deploy | Vercel |

---

## 15. Dashboard — socios sin pago (decisión 2026-05-16)

En el dashboard del admin, los socios sin pago del mes se muestran en **dos tablas separadas**:

| Tabla | Condición | Acción sugerida |
|-------|-----------|----------------|
| **Sin pago — siguen viniendo** | Sin payment_record pagado + ≥ 1 visita este mes | Recordarles en la próxima visita |
| **Sin pago — no vinieron este mes** | Sin payment_record pagado + 0 visitas este mes | Evaluar si contactar o desactivar (posible churn) |

Cada tabla muestra máx. 10 filas, ordenadas por fecha de última visita ascendente (los más críticos primero). Incluyen: nombre, DNI, créditos disponibles, fecha de última visita, badge de pago. Cada fila linkea al detalle del socio.

**Motivación:** un socio que sigue viniendo sin pagar necesita una gestión de cobranza; uno que no viene Y no pagó es una señal de churn y requiere una evaluación diferente (contacto, desactivación).

---

## 15. Anti-objetivos del v1

Nada registrado por ahora; agregar viñetas cuando algo quede **explícitamente fuera de alcance** (mantiene honestas las specs). Ejemplos que otros proyectos suelen diferir: apps nativas, checkout Stripe, jerarquías de franquicia más allá del modelo multi-gym plano — solo listá lo que **decidan no hacer**.

---

## 16. Futuras mejoras

Ideas **fuera del v1** de Fichaje solo con DNI; sirve para no perder el hilo cuando escalés seguridad o UX.

### PIN corto por socio (segundo factor en fichaje público)

- **Problema:** Con solo **documento**, la ruta pública del QR es más sensible a **suplantación** (adivinar o espiar DNIs), además del límite de frecuencia y mensajes genéricos.
- **Idea:** Cada socio tiene (o define en portal/recepción) un **PIN corto** (p. ej. 4–6 dígitos), opcionalmente rotativo por política del gym.
- **UX:** En la web tras escanear el QR del gym: campo **documento** + campo **PIN** → mismas respuestas que hoy (“podés pasar”, créditos restantes, etc.). En **Fichaje recepción** el PIN puede ser **opcional** (el staff ya valida identidad) u obligatorio según configuración futura.
- **Specs cuando llegue:** regeneración de PIN, bloqueo tras intentos fallidos, recuperación en recepción, almacenamiento seguro (hash, no texto plano).

*(Podés sumar aquí otras mejoras acordadas — p. ej. integración Stripe, app nativa, notificaciones push.)*

---

## 17. Lista de verificación antes de codificar

- [ ] Glosario y RBAC alineados con §5–§7  
- [ ] Reglas de dominio (`DR-xx`): ventanas de créditos/mes, modos de Configuración, inscripciones solapadas  
- [ ] OpenAPI de la franja 1 + borrador de aceptación  
- [ ] Línea base de textos en español para flujos críticos (morosidad, advertencia por exceso)  
- [ ] Reglas de **Fichaje**: 1 visita/día/socio/gym; mensajes en español; límites anti-abuso en ruta pública  
- [ ] Dashboard de inicio + columna de créditos en tabla de socios  

---

## 18. Historial de revisiones

| Fecha | Cambio |
|------|--------|
| _(inicial)_ | Borrador del plan desde el descubrimiento; MVP: pagos manuales, portal de socio limitado, libro preparado para Stripe. |
| 2026-04-30 | Planes a nivel gym ARS + créditos/mes; español/ARS; Configuración ante exceso + umbral del dashboard; RBAC (Superadmin socios/gym/admin; selector de gym para admin); **Fichaje v1**: DNI en panel + web pública por **QR estable/gym**, **1 fichaje/día/socio/gym**, tabla **créditos disponibles**, dashboard **0 / cercanos a 0**; canales de visita `fichaje_admin`, `fichaje_public`, `staff_manual`. |
| 2026-04-30 | §16 **Futuras mejoras**: PIN corto por socio como segundo factor en fichaje público (fuera del v1). |
| 2026-05-18 | **Rate limiting** en ruta pública `/g/*`: `proxy.ts` integra Upstash Redis con sliding window 10 req/10 s por IP — corta antes de tocar auth ni BD. Riesgo DR-xx de abuso por DNI marcado como resuelto (parcialmente). |
| 2026-05-18 | **Rediseño dashboard**: estilo "Morning Briefing" — header editorial con fecha, alertas de socios sin pago al tope (prioridad visual), KPIs como fila de stats sin tarjetas, gráficos abajo. Seleccionado tras prototipar 3 variantes (Command Center / Morning Briefing / Tri-Panel Board). |

---

Para seguir refinando, editá las secciones directamente o pedí cambios por bloque. El objetivo es que **PROJECT.md** se pueda leer de una sentada y que las specs detalladas vivan en documentos enlazados cuando aparezcan.
