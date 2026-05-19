import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { and, desc, eq, gte, sql, sum } from 'drizzle-orm'
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
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { cn, formatARS } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CreditAdjustmentForm } from './_components/credit-adjustment-form'
import { EnrollMemberDialog } from './_components/enroll-member-dialog'

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatDateTime(ts: Date | string | null | undefined) {
  if (!ts) return '—'
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

const channelLabel: Record<string, string> = {
  fichaje_admin: 'Recepción',
  fichaje_public: 'QR',
  staff_manual: 'Manual',
}

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)?.value
  if (!gymId) redirect('/admin/select-gym')

  const [gym] = await db
    .select({ timezone: gyms.timezone })
    .from(gyms)
    .where(eq(gyms.id, gymId))
    .limit(1)

  const gymTimezone = gym?.timezone ?? 'America/Argentina/Buenos_Aires'

  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, id), eq(members.gymId, gymId)))
    .limit(1)

  if (!member) notFound()

  const [[enrollment], activePlans] = await Promise.all([
    db
      .select({
        planId: enrollments.planId,
        planName: membershipPlans.name,
        planType: membershipPlans.planType,
        creditsPerMonth: membershipPlans.creditsPerMonth,
        startedAt: enrollments.startedAt,
      })
      .from(enrollments)
      .innerJoin(membershipPlans, eq(membershipPlans.id, enrollments.planId))
      .where(and(eq(enrollments.memberId, id), eq(enrollments.gymId, gymId), eq(enrollments.active, 'true')))
      .limit(1),

    db
      .select({
        id: membershipPlans.id,
        name: membershipPlans.name,
        planType: membershipPlans.planType,
        priceArs: membershipPlans.priceArs,
        creditsPerMonth: membershipPlans.creditsPerMonth,
      })
      .from(membershipPlans)
      .where(and(eq(membershipPlans.gymId, gymId), eq(membershipPlans.active, 'true'))),
  ])

  const monthStart = sql`(date_trunc('month', now() AT TIME ZONE ${gymTimezone}) AT TIME ZONE ${gymTimezone})`

  const [recentVisits, [{ adjustmentSum }], lastPayments] = await Promise.all([
    db
      .select({
        id: visits.id,
        visitedAt: visits.visitedAt,
        channel: visits.channel,
        overLimit: visits.overLimit,
      })
      .from(visits)
      .where(and(eq(visits.memberId, id), eq(visits.gymId, gymId)))
      .orderBy(desc(visits.visitedAt))
      .limit(30),

    db
      .select({ adjustmentSum: sum(creditAdjustments.amount) })
      .from(creditAdjustments)
      .where(
        and(
          eq(creditAdjustments.memberId, id),
          eq(creditAdjustments.gymId, gymId),
          gte(creditAdjustments.date, sql`date_trunc('month', now() AT TIME ZONE ${gymTimezone})::date`)
        )
      ),

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
      .where(and(eq(paymentRecords.memberId, id), eq(paymentRecords.gymId, gymId)))
      .orderBy(desc(paymentRecords.periodStart))
      .limit(12),
  ])

  const recentAdjustments = await db
    .select({
      id: creditAdjustments.id,
      amount: creditAdjustments.amount,
      date: creditAdjustments.date,
      notes: creditAdjustments.notes,
    })
    .from(creditAdjustments)
    .where(and(eq(creditAdjustments.memberId, id), eq(creditAdjustments.gymId, gymId)))
    .orderBy(desc(creditAdjustments.date))
    .limit(20)

  const usedCreditsThisMonth = recentVisits.filter((v) => {
    const d = new Date(v.visitedAt as Date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && v.overLimit === 'false'
  }).length

  const adjustments = Number(adjustmentSum ?? 0)
  const isUnlimited = enrollment?.planType === 'unlimited'
  const creditsLeft = isUnlimited
    ? null
    : enrollment
      ? (enrollment.creditsPerMonth ?? 0) - usedCreditsThisMonth + adjustments
      : null

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/members" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← Socios
        </Link>
        <h1 className="text-2xl font-semibold">{member.fullName}</h1>
        {member.active === 'false' && (
          <Badge variant="secondary">Inactivo</Badge>
        )}
      </div>

      {/* Profile + Plan */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 space-y-3">
          <h2 className="font-semibold text-sm text-zinc-500 uppercase tracking-wide">Datos personales</h2>
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
              <dt className="text-zinc-500">Fecha de alta</dt>
              <dd>{formatDate(member.joinedAt)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-zinc-500 uppercase tracking-wide">Membresía</h2>
            <EnrollMemberDialog
              memberId={member.id}
              plans={activePlans}
              hasActiveEnrollment={!!enrollment}
            />
          </div>
          {enrollment ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Plan</dt>
                <dd className="font-medium">{enrollment.planName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Tipo</dt>
                <dd>{isUnlimited ? 'Libre (ilimitado)' : 'Por créditos'}</dd>
              </div>
              {!isUnlimited && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Créditos este mes</dt>
                    <dd
                      className={cn(
                        'font-semibold',
                        (creditsLeft ?? 0) <= 0 ? 'text-red-600' : (creditsLeft ?? 0) <= 2 ? 'text-yellow-600' : 'text-green-600'
                      )}
                    >
                      {creditsLeft} restantes
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Usados este mes</dt>
                    <dd>{usedCreditsThisMonth} de {enrollment.creditsPerMonth}</dd>
                  </div>
                </>
              )}
              {isUnlimited && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Créditos</dt>
                  <dd className="text-green-600 font-semibold">Acceso ilimitado</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-zinc-500">Desde</dt>
                <dd>{formatDateTime(enrollment.startedAt)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-zinc-400">Sin plan activo</p>
          )}
        </Card>
      </div>

      {/* Last payments */}
      {lastPayments.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Historial de pagos</h2>
          <div className="rounded-lg border bg-white divide-y text-sm">
            {lastPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium">{formatARS(p.amountArs)}</span>
                  <span className="ml-3 text-zinc-500">
                    {formatDate(p.periodStart as unknown as string)} – {formatDate(p.periodEnd as unknown as string)}
                  </span>
                </div>
                <Badge variant={p.status === 'paid' ? 'default' : p.status === 'overdue' ? 'destructive' : 'secondary'}>
                  {p.status === 'paid' ? 'Pagado' : p.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent visits */}
      <div className="space-y-3">
        <h2 className="font-semibold">Historial de fichajes</h2>
        {recentVisits.length === 0 ? (
          <p className="text-sm text-zinc-400">Sin fichajes registrados.</p>
        ) : (
          <div className="rounded-lg border bg-white divide-y text-sm">
            {recentVisits.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-4 py-3">
                <span>{formatDateTime(v.visitedAt)}</span>
                <div className="flex gap-2">
                  <span className="text-zinc-400">{channelLabel[v.channel] ?? v.channel}</span>
                  {v.overLimit === 'true' && (
                    <Badge variant="destructive">Sin créditos</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Credit adjustments */}
      <div className="space-y-4">
        <h2 className="font-semibold">Ajustes de crédito</h2>
        <p className="text-sm text-zinc-500">
          Usá esto para registrar entradas que no quedaron fichadas, o para corregir créditos manualmente.
        </p>
        <CreditAdjustmentForm memberId={member.id} />

        {recentAdjustments.length > 0 && (
          <div className="rounded-lg border bg-white divide-y text-sm mt-4">
            {recentAdjustments.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span
                    className={cn(
                      'font-semibold mr-3',
                      a.amount > 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {a.amount > 0 ? `+${a.amount}` : a.amount}
                  </span>
                  <span className="text-zinc-500">{a.notes ?? '—'}</span>
                </div>
                <span className="text-zinc-400">{formatDate(a.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
