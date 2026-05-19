// Auth lives here; all data fetching is in lib/domain/member.ts.
// See the convention comment at the top of that file.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMemberPortalData } from '@/lib/domain/member'
import { cn, formatARS } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

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

  const { member, gym, enrollment, lastVisit, creditsLeft, usedCredits, hasPaid, recentPayments } = data

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
                  {enrollment.planType === 'unlimited' ? (
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
              {enrollment.planType !== 'unlimited' && (
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
                    {formatDate(p.periodStart)} –{' '}
                    {formatDate(p.periodEnd)}
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
