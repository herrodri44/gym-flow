import { redirect } from 'next/navigation'
import { and, desc, eq, gte, lte, max, sql, sum } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db/client'
import {
  gyms,
  members,
  enrollments,
  membershipPlans,
  visits,
  creditAdjustments,
  paymentRecords,
} from '@/lib/db/schema'
import { cn, formatARS } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatDateTime(ts: Date | string | null | undefined) {
  if (!ts) return '—'
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return (
    d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  )
}

export default async function PortalAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Find the member profile linked to this user
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.userId, user.id), eq(members.active, 'true')))
    .limit(1)

  if (!member) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-500">No encontramos tu perfil de socio.</p>
        <p className="mt-1 text-sm text-zinc-400">Contactá al gimnasio para que te den de alta.</p>
      </div>
    )
  }

  const [gym] = await db
    .select({ name: gyms.name, timezone: gyms.timezone })
    .from(gyms)
    .where(eq(gyms.id, member.gymId))
    .limit(1)

  const gymTimezone = gym?.timezone ?? 'America/Argentina/Buenos_Aires'
  const gymName = gym?.name ?? 'Gimnasio'

  const [enrollment] = await db
    .select({
      planName: membershipPlans.name,
      planType: membershipPlans.planType,
      creditsPerMonth: membershipPlans.creditsPerMonth,
      priceArs: membershipPlans.priceArs,
      startedAt: enrollments.startedAt,
    })
    .from(enrollments)
    .innerJoin(membershipPlans, eq(membershipPlans.id, enrollments.planId))
    .where(
      and(
        eq(enrollments.memberId, member.id),
        eq(enrollments.gymId, member.gymId),
        eq(enrollments.active, 'true')
      )
    )
    .limit(1)

  const monthStart = sql`(date_trunc('month', now() AT TIME ZONE ${gymTimezone}) AT TIME ZONE ${gymTimezone})`

  const [[lastVisitRow], [{ visitCount }], [{ adjustmentSum }], hasPaidRow, recentPayments] =
    await Promise.all([
      db
        .select({ lastVisit: max(visits.visitedAt) })
        .from(visits)
        .where(and(eq(visits.memberId, member.id), eq(visits.gymId, member.gymId))),

      db
        .select({ visitCount: sql<number>`count(*)` })
        .from(visits)
        .where(
          and(
            eq(visits.memberId, member.id),
            eq(visits.gymId, member.gymId),
            eq(visits.overLimit, 'false'),
            gte(visits.visitedAt, monthStart)
          )
        ),

      db
        .select({ adjustmentSum: sum(creditAdjustments.amount) })
        .from(creditAdjustments)
        .where(
          and(
            eq(creditAdjustments.memberId, member.id),
            eq(creditAdjustments.gymId, member.gymId),
            gte(
              creditAdjustments.date,
              sql`date_trunc('month', now() AT TIME ZONE ${gymTimezone})::date`
            )
          )
        ),

      db
        .select({ id: paymentRecords.id })
        .from(paymentRecords)
        .where(
          and(
            eq(paymentRecords.memberId, member.id),
            eq(paymentRecords.gymId, member.gymId),
            eq(paymentRecords.status, 'paid'),
            lte(paymentRecords.periodStart, sql`now()`),
            gte(paymentRecords.periodEnd, sql`now()`)
          )
        )
        .limit(1),

      db
        .select({
          id: paymentRecords.id,
          amountArs: paymentRecords.amountArs,
          status: paymentRecords.status,
          periodStart: paymentRecords.periodStart,
          periodEnd: paymentRecords.periodEnd,
          paidAt: paymentRecords.paidAt,
        })
        .from(paymentRecords)
        .where(and(eq(paymentRecords.memberId, member.id), eq(paymentRecords.gymId, member.gymId)))
        .orderBy(desc(paymentRecords.periodStart))
        .limit(6),
    ])

  const hasPaid = hasPaidRow.length > 0
  const usedCredits = Number(visitCount ?? 0)
  const adjustments = Number(adjustmentSum ?? 0)
  const isUnlimited = enrollment?.planType === 'unlimited'
  const creditsLeft = isUnlimited
    ? null
    : enrollment
      ? (enrollment.creditsPerMonth ?? 0) - usedCredits + adjustments
      : null

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">{gymName}</p>
        <h1 className="text-2xl font-semibold">{member.fullName}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Personal data */}
        <Card className="p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Datos personales</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Documento</dt>
              <dd className="font-medium">{member.documentNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Email</dt>
              <dd>{member.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Teléfono</dt>
              <dd>{member.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Fecha de nacimiento</dt>
              <dd>{formatDate(member.birthDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Socio desde</dt>
              <dd>{formatDate(member.joinedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Último ingreso</dt>
              <dd>{formatDateTime(lastVisitRow?.lastVisit)}</dd>
            </div>
          </dl>
        </Card>

        {/* Plan & credits */}
        <Card className="p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Membresía</h2>
          {enrollment ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Plan</dt>
                <dd className="font-medium">{enrollment.planName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Precio</dt>
                <dd>{formatARS(enrollment.priceArs)} / mes</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Créditos este mes</dt>
                <dd>
                  {isUnlimited ? (
                    <span className="text-green-600 font-semibold">Acceso ilimitado</span>
                  ) : (
                    <span
                      className={cn(
                        'font-semibold',
                        (creditsLeft ?? 0) <= 0
                          ? 'text-red-600'
                          : (creditsLeft ?? 0) <= 2
                            ? 'text-yellow-600'
                            : 'text-green-600'
                      )}
                    >
                      {creditsLeft} restantes
                    </span>
                  )}
                </dd>
              </div>
              {!isUnlimited && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Usados este mes</dt>
                  <dd>{usedCredits} de {enrollment.creditsPerMonth}</dd>
                </div>
              )}
              <div className="flex justify-between items-center">
                <dt className="text-zinc-500">Cuota del mes</dt>
                <dd>
                  <Badge variant={hasPaid ? 'default' : 'destructive'}>
                    {hasPaid ? 'Al día' : 'Pendiente'}
                  </Badge>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-zinc-400">Sin plan activo. Contactá al gimnasio.</p>
          )}
        </Card>
      </div>

      {/* Payment history */}
      {recentPayments.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Historial de pagos</h2>
          <div className="rounded-lg border bg-white divide-y text-sm">
            {recentPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium">{formatARS(p.amountArs)}</span>
                  <span className="ml-3 text-zinc-500">
                    {formatDate(p.periodStart as unknown as string)} –{' '}
                    {formatDate(p.periodEnd as unknown as string)}
                  </span>
                </div>
                <Badge
                  variant={
                    p.status === 'paid'
                      ? 'default'
                      : p.status === 'overdue'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {p.status === 'paid' ? 'Pagado' : p.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
