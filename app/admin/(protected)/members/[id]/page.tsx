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
import { EnrollMemberDialog } from './_components/enroll-member-dialog'

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

  const {
    member,
    enrollment,
    activePlans,
    creditsLeft,
    usedCreditsThisMonth,
    recentVisits,
    lastPayments,
    recentAdjustments,
  } = data

  const isUnlimited = enrollment?.planType === 'unlimited'

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/members" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← Socios
        </Link>
        <h1 className="text-2xl font-semibold">{member.fullName}</h1>
        {!member.active && (
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
                        (creditsLeft ?? 0) <= 0
                          ? 'text-red-600'
                          : (creditsLeft ?? 0) <= 2
                            ? 'text-yellow-600'
                            : 'text-green-600'
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
                    {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
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
