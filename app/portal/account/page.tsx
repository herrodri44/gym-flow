// Auth lives here; all data fetching is in lib/domain/member.ts.
// See the convention comment at the top of that file.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMemberPortalData } from '@/lib/domain/member'
import { cn, formatARS } from '@/lib/utils'
import { Card } from '@/components/ui/card'
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

export default async function PortalAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const data = await getMemberPortalData(user.id)

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-500">No encontramos tu perfil de socio.</p>
        <p className="mt-1 text-sm text-zinc-400">Contactá al gimnasio para que te den de alta.</p>
      </div>
    )
  }

  const { member, gym, standing, lastVisit, recentPeriods } = data
  const status = standing?.status ?? 'no_plan'
  const validUntil = standing?.endDate ? addDays(standing.endDate, -1) : null

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">{gym.name}</p>
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
              <dd>{formatDateTime(lastVisit)}</dd>
            </div>
          </dl>
        </Card>

        {/* Plan & credits */}
        <Card className="p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Membresía</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Estado</dt>
              <dd className={cn('font-semibold', STANDING_TEXT_CLASS[status])}>{STANDING_LABEL[status]}</dd>
            </div>
            {standing?.periodId && (
              <>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Plan</dt>
                  <dd className="font-medium">{standing.planName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">{status === 'active' ? 'Válido hasta' : 'Venció el'}</dt>
                  <dd>{formatDay(status === 'active' ? validUntil : standing.endDate)}</dd>
                </div>
                {status === 'active' && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Créditos</dt>
                    <dd>
                      {standing.planType === 'unlimited' ? (
                        <span className="text-green-600 font-semibold">Acceso ilimitado</span>
                      ) : (
                        <span
                          className={cn(
                            'font-semibold',
                            (standing.creditsLeft ?? 0) <= 0
                              ? 'text-red-600'
                              : (standing.creditsLeft ?? 0) <= 2
                                ? 'text-yellow-600'
                                : 'text-green-600'
                          )}
                        >
                          Te quedan {standing.creditsLeft}
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                {status !== 'active' && (
                  <p className="pt-1 text-xs text-zinc-500">Renová tu cuota en el gimnasio para volver a entrenar.</p>
                )}
              </>
            )}
            {status === 'no_plan' && (
              <p className="text-sm text-zinc-400">Sin plan activo. Contactá al gimnasio.</p>
            )}
          </dl>
        </Card>
      </div>

      {/* Payment history */}
      {recentPeriods.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Mis pagos</h2>
          <div className="rounded-lg border bg-white divide-y text-sm">
            {recentPeriods.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{formatARS(p.amountArs)} · {p.planName}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {formatDay(p.startDate)} → {formatDay(addDays(p.endDate, -1))}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-400">Pagó {formatDay(p.paidOn)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
