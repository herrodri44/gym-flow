# GymDex — definición del producto

**Qué es este documento:** qué hace el producto, para quién y con qué reglas
de negocio. Es la referencia para decidir comportamiento.
**Cómo se construye y qué se está haciendo ahora:** ver `PLAN.md`.

**Estado (2026-10-01):** en producción con un gimnasio. La facturación por
períodos (§6) está decidida y en implementación; hasta que salga, el sistema
todavía genera cuotas por mes calendario.

---

## 1. Visión y problema

GymDex es una aplicación web multi-gimnasio para la operación diaria: socios,
planes, ingreso (fichaje), pagos y métricas.

**Problemas que resuelve para quien administra el gym:**
- Los socios **se olvidan de pagar** la cuota.
- Pueden **venir más veces de las que permite su plan**, y es difícil de controlar.

**Resultado esperado:** ingreso registrado, visibilidad de quién está al día
y quién no, y métricas para el admin (cobranzas, días y horarios pico).

---

## 2. Personas

| Persona | Qué hace |
|---|---|
| **Superadministrador** | Plataforma: ve y crea gimnasios, crea administradores y los asigna a gimnasios, resetea sus contraseñas. No opera gimnasios (no ve socios, fichaje ni pagos). |
| **Administrador de gimnasio** | Opera el gym activo: socios, planes, pagos, fichaje en recepción, QR, configuración, dashboard y analíticas. Si tiene varios gimnasios asignados elige uno y puede cambiarlo desde la barra. Acepta los Términos en su primer ingreso. |
| **Socio** | Ficha con su DNI (recepción o QR, sin login). Si tiene email, tiene un portal de solo lectura con su plan, vigencia, créditos y pagos. |

---

## 3. Permisos

| Capacidad | Superadmin | Admin de gym | Socio |
|---|---|---|---|
| Gimnasios y administradores | Sí | No | No |
| Socios, planes, pagos, configuración | No | Sí, solo gimnasios asignados | No |
| Fichaje | No | Recepción (DNI o nombre) | QR público (solo DNI) |
| Dashboard y analíticas | No | Gym activo | Solo su propio estado |

El rol no alcanza: toda acción de un admin se limita al **gym activo**, y el
servidor verifica que esté asignado a ese gym.

---

## 4. Glosario

| Código | UI | Significado |
|---|---|---|
| `Gym` | Gimnasio | Límite de inquilino; tiene huso horario y configuración. |
| `Member` | Socio | Persona que entrena; identificada por DNI dentro de su gym. |
| `MembershipPlan` | Plan | Definido por cada gym: `credits` (N créditos por período) o `unlimited`. Precio en ARS. |
| `PaymentRecord` | Pago | Dinero recibido. Solo existe cuando el socio pagó. |
| `MembershipPeriod` | Vigencia / período | Lo que habilita un pago: plan, créditos y fechas de inicio y vencimiento. |
| `Visit` | Ingreso / fichaje | Un ingreso registrado. Canales: `fichaje_admin`, `fichaje_public`, `staff_manual`. |
| `CreditAdjustment` | Ajuste de créditos | Corrección manual (+/−) con nota y autor; por ejemplo, un ingreso que no se fichó. |
| Estado del socio | Al día / En gracia / Vencido / Sin plan | Se calcula a partir de su último período (§6). |

---

## 5. Fichaje (ingreso)

- **Recepción** (`/admin/check-in`): búsqueda por DNI o nombre; si hay varias
  coincidencias, el admin elige. Muestra el estado y los créditos y pide
  confirmación.
- **QR público** (`/g/[slug]`): QR imprimible por gym; el socio ingresa solo
  su DNI. No se muestran nombres ni datos personales.
- **Un ingreso por socio por día** (día del huso horario del gym). Un segundo
  intento muestra "Ya registramos tu ingreso hoy" y no consume crédito.
- **Resultado según el estado del socio:**

| Situación | Resultado |
|---|---|
| Período vigente con créditos (o plan libre) | Pasa; se muestran los créditos restantes y la fecha de vencimiento. |
| Período vigente, sin créditos | Según la configuración "permitir exceso": se rechaza, o pasa con advertencia (`over_limit`). |
| Período vencido, dentro de los días de gracia | Pasa con advertencia "tu cuota venció". El ingreso se descuenta del próximo período cuando pague. |
| Período vencido, fuera de gracia, o nunca pagó | No pasa: "Hablá con la recepción". |

---

## 6. Facturación por períodos

Un **pago habilita un período** de un mes que arranca ese día. No hay cuotas
por mes calendario ni cuotas "pendientes" generadas automáticamente.

**Reglas:**
1. **Vigencia:** si paga el 5/10, el período vale **hasta el 4/11 inclusive**
   y el próximo pago vence el 5/11.
2. **Créditos:** el período otorga los créditos del plan. Los que sobran al
   vencer **se pierden**; no se acumulan.
3. **Pago tardío:** el nuevo período arranca el día del pago. El admin puede
   editar la fecha de inicio, por ejemplo si carga tarde un pago o acuerda
   otra fecha.
4. **Pago anticipado:** si paga antes de que venza el período actual, el
   nuevo empieza cuando termina el actual. Los créditos que le quedan siguen
   valiendo hasta entonces.
5. **Días 29, 30 y 31:** se mantiene el día original. Si paga el 31/1, vence
   el 28/2 (o el 29 en año bisiesto); el siguiente período renovado sin
   interrupción vence el 31/3.
6. **Gracia:** cada gym configura N días de gracia (por defecto 0). Durante
   la gracia el socio puede entrar con advertencia, y esos ingresos se
   descuentan del próximo período.
7. **Plan libre:** mismas fechas, sin conteo de créditos.
8. **Cambio de plan o de precio:** aplica al próximo pago. Cada período
   guarda su propio plan, precio y créditos.
9. **Sin pausas ni congelamientos** por ahora.
10. **El plan del socio es el de su último pago.** Al registrar un pago se
    elige el plan (precargado con el anterior).

**Créditos disponibles** = créditos del período − ingresos del período (sin
contar los marcados como exceso) + ajustes del período.

**Estado del socio:** *Al día* (período vigente) · *En gracia* (venció hace
≤ N días) · *Vencido* · *Sin plan* (nunca pagó).

---

## 7. Dashboard del admin

- **Indicadores:** socios activos, ingresos del mes y de la semana, recaudado
  en el mes (pagos recibidos según fecha de pago), socios vencidos.
- **Listas de seguimiento:**
  - **Vencidos:** fecha de vencimiento, créditos que le sobraron, días desde
    que venció.
  - **Vencen en los próximos 7 días:** para avisar antes.
  - **Sin créditos antes de vencer:** candidatos a cambiar de plan.
- **Gráficos:** ingresos únicos por mes (12 meses) y estado de pago de los
  socios activos.

**Analíticas:** ingresos por día (30 días), mapa de calor por día y hora,
recaudación por mes y distribución por plan. Siempre se calculan en el huso
horario del gym y en el servidor.

---

## 8. Configuración del gym

- **Información:** nombre, dirección, teléfono, email, horarios y huso horario.
- **Operativa:**
  - permitir ingreso sin créditos (`allow_over_limit`, por defecto no);
  - días de gracia (por defecto 0);
  - umbral de "pocos créditos" (por defecto 2).
- **QR:** imprimir y copiar el enlace de fichaje público.
- **Importar socios:** CSV con plantilla (máximo 500 filas).
- **Cuenta:** cambio de contraseña del admin.

---

## 9. Socios

- Se crean a mano o por CSV. El DNI es único dentro del gym.
- Baja lógica: un socio inactivo no puede fichar; su historial se conserva.
- Notas internas por socio.
- Si tiene email, se crea su acceso al portal. Hoy la contraseña inicial es
  el DNI; se va a pedir cambiarla en el primer ingreso (ver `PLAN.md`).

---

## 10. Legal

- Ley 25.326 (Argentina): GymDex es **encargado del tratamiento**; el gimnasio
  es el **responsable**. Hay política de privacidad en `/legal/privacidad`.
- Términos B2B en `/legal/terminos`, aceptados por cada admin en su primer
  ingreso (`profiles.terms_accepted_at`).
- NDA / confidencialidad: documento fuera de la app, se envía en el
  onboarding de cada gimnasio.

---

## 11. Fuera de alcance (por ahora)

- Cobro online: los pagos se registran a mano. `payment_records` tiene
  columnas reservadas para un proveedor como Stripe.
- Pausas o congelamiento de membresías.
- App nativa.
- Panel operativo del superadmin dentro de un gym o impersonación.

## 12. Ideas futuras

- **Botón de WhatsApp** en las listas de vencidos y por vencer, con mensaje
  precargado.
- **PIN corto por socio** como segundo factor en el QR público (DNI + PIN),
  para evitar que alguien fiche con un DNI ajeno.
- **"Olvidé mi contraseña"** por email.
