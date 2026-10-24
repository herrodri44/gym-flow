// Auth lives in the layout; all data fetching is in lib/domain/member-detail.ts.
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getMemberDetail } from '@/lib/domain/member-detail'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { cn, formatARS } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CreditAdjustmentForm } from './_components/credit-adjustment-form'
import { MemberNotesForm } from './_components/member-notes-form'
import { RegisterPaymentDialog } from '../../payments/_components/register-payment-dialog'
import { PaymentRowActions } from '../../payments/_components/payment-row-actions'
import { addDays } from '@/lib/domain/period-math'
import { STANDING_LABEL, STANDING_TEXT_CLASS, formatDay } from '@/lib/standing-ui'

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  if (value instanceof Date) {
    return value.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }
  const [y, m, d] = value.split('-')
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

  const data = await getMemberDetail(id, gymId)
  if (!data) notFound()

  const { member, standing, paymentOption, plans, periods, recentVisits, recentAdjustments } = data
  const hasPeriod = !!standing?.periodId
  const isUnlimited = standing?.planType === 'unlimited'
  const status = standing?.status ?? 'no_plan'

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/admin/members" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← Socios
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold truncate">{member.fullName}</h1>
          {!member.active && <Badge variant="secondary" className="shrink-0">Inactivo</Badge>}
        </div>
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
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-sm text-zinc-500 uppercase tracking-wide">Membresía</h2>
            {paymentOption && standing && (
              <RegisterPaymentDialog
                members={[paymentOption]}
                fixedMember={paymentOption}
                plans={plans}
                today={standing.today}
                triggerLabel={hasPeriod ? 'Renovar' : 'Registrar pago'}
                triggerVariant={status === 'active' ? 'outline' : 'default'}
                triggerSize="sm"
              />
            )}
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Estado</dt>
              <dd className={cn('font-semibold', STANDING_TEXT_CLASS[status])}>{STANDING_LABEL[status]}</dd>
            </div>
            {standing && hasPeriod && (
              <>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Plan</dt>
                  <dd className="font-medium">{standing.planName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Período</dt>
                  <dd>
                    {formatDay(standing.startDate)} → {formatDay(addDays(standing.endDate!, -1))}
                  </dd>
                </div>
                {status === 'active' && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Vence en</dt>
                    <dd>{standing.daysLeft} {standing.daysLeft === 1 ? 'día' : 'días'}</dd>
                  </div>
                )}
                {(status === 'grace' || status === 'expired') && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Venció</dt>
                    <dd className="text-red-600">
                      el {formatDay(standing.endDate)} (hace {standing.daysSinceExpiry} d)
                    </dd>
                  </div>
                )}
                {isUnlimited ? (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Créditos</dt>
                    <dd className="text-green-600 font-semibold">Acceso ilimitado</dd>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">
                      {status === 'active' ? 'Créditos disponibles' : 'Créditos que sobraron'}
                    </dt>
                    <dd
                      className={cn(
                        'font-semibold',
                        status !== 'active'
                          ? 'text-zinc-500'
                          : (standing.creditsLeft ?? 0) <= 0
                            ? 'text-red-600'
                            : (standing.creditsLeft ?? 0) <= 2
                              ? 'text-yellow-600'
                              : 'text-green-600'
                      )}
                    >
                      {standing.creditsLeft} de {(standing.creditsGranted ?? 0) + standing.creditsAdjusted}
                    </dd>
                  </div>
                )}
                {standing.graceVisits > 0 && (
                  <p className="text-xs text-amber-700">
                    {standing.graceVisits} {standing.graceVisits === 1 ? 'ingreso' : 'ingresos'} en gracia: se
                    descuentan del próximo período.
                  </p>
                )}
                {standing.hasUpcoming && (
                  <p className="text-xs text-sky-700">Ya renovó: el próximo período empieza al terminar este.</p>
                )}
              </>
            )}
            {status === 'no_plan' && <p className="text-sm text-zinc-400">Todavía no registró pagos.</p>}
          </dl>
        </Card>
      </div>

      {/* Notes */}
      <Card className="p-6 space-y-3">
        <h2 className="font-semibold text-sm text-zinc-500 uppercase tracking-wide">Notas internas</h2>
        <MemberNotesForm memberId={member.id} notes={member.notes} />
      </Card>

      {/* Periods / payments */}
      {periods.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Pagos y períodos</h2>
          <div className="rounded-lg border bg-white divide-y text-sm">
            {periods.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {formatDay(p.startDate)} → {formatDay(addDays(p.endDate, -1))}
                    <span className="ml-2 font-normal text-zinc-500">{p.planName}</span>
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {formatARS(p.amountArs)} · pagó {formatDay(p.paidOn)}
                    {p.planType === 'credits' && ` · usó ${p.creditsUsed} de ${p.creditsGranted}`}
                    {p.notes && ` · ${p.notes}`}
                  </p>
                </div>
                <PaymentRowActions paymentId={p.paymentId} memberId={member.id} />
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
                  {v.overLimit && (
                    <Badge variant="destructive">Sin créditos</Badge>
                  )}
                  {v.unassigned && (
                    <Badge variant="secondary">Sin período</Badge>
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
