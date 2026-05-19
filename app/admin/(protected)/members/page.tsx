// Auth lives in the layout; all data fetching is in lib/domain/members-list.ts.
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getMembersList } from '@/lib/domain/members-list'
import type { MembersListFilters } from '@/lib/domain/members-list'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CreateMemberDialog } from './_components/create-member-dialog'
import { MemberActionsMenu } from './_components/member-actions-menu'

function buildUrl(
  filters: MembersListFilters,
  overrides: Partial<MembersListFilters> = {},
  selectedId?: string | null
) {
  const merged = { ...filters, ...overrides }
  const params = new URLSearchParams()
  if (merged.q) params.set('q', merged.q)
  if (merged.status !== 'active') params.set('status', merged.status)
  if (merged.payment !== 'all') params.set('payment', merged.payment)
  if ((merged.page ?? 1) > 1) params.set('page', String(merged.page))
  if (selectedId) params.set('selected', selectedId)
  const qs = params.toString()
  return `/admin/members${qs ? '?' + qs : ''}`
}

function buildSelectUrl(filters: MembersListFilters, memberId: string) {
  const params = new URLSearchParams({ selected: memberId })
  if (filters.q) params.set('q', filters.q)
  if (filters.status !== 'active') params.set('status', filters.status)
  if (filters.payment !== 'all') params.set('payment', filters.payment)
  if (filters.page > 1) params.set('page', String(filters.page))
  return `/admin/members?${params.toString()}`
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatDateTime(ts: Date | string | null) {
  if (!ts) return '—'
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return (
    d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  )
}

const STATUS_TABS: { value: MembersListFilters['status']; label: string }[] = [
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'all', label: 'Todos' },
]

const PAYMENT_TABS: { value: MembersListFilters['payment']; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'paid', label: 'Al día' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'overdue', label: 'Vencida' },
]

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const filters: MembersListFilters = {
    q: typeof sp.q === 'string' ? sp.q.trim() : '',
    status: (typeof sp.status === 'string' ? sp.status : 'active') as MembersListFilters['status'],
    payment: (typeof sp.payment === 'string' ? sp.payment : 'all') as MembersListFilters['payment'],
    page: Math.max(1, Number(typeof sp.page === 'string' ? sp.page : '1') || 1),
  }
  const selectedId = typeof sp.selected === 'string' ? sp.selected : null

  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const { rows, total, totalPages } = await getMembersList(gymId, filters)

  const selected = selectedId ? (rows.find((m) => m.id === selectedId) ?? null) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Socios</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {total} {total === 1 ? 'socio' : 'socios'}
          </p>
        </div>
        <CreateMemberDialog />
      </div>

      {/* Tab-pill filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide mr-1">Estado</span>
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={buildUrl(filters, { status: tab.value, page: 1 }, selectedId)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                filters.status === tab.value
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="w-px self-stretch bg-zinc-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide mr-1">Cuota</span>
          {PAYMENT_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={buildUrl(filters, { payment: tab.value, page: 1 }, selectedId)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                filters.payment === tab.value
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Split panel */}
      <div className="flex h-[70vh] min-h-96 gap-4">
        {/* Left: member list */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-3">
            <form method="get" className="flex gap-1.5">
              <input type="hidden" name="status" value={filters.status} />
              <input type="hidden" name="payment" value={filters.payment} />
              {selectedId && <input type="hidden" name="selected" value={selectedId} />}
              <Input
                name="q"
                defaultValue={filters.q}
                placeholder="Buscar…"
                className="h-8 flex-1 text-sm"
              />
              <Button type="submit" variant="outline" size="sm" className="h-8 px-2 text-xs">
                Ir
              </Button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto">
            {rows.map((m) => (
              <Link
                key={m.id}
                href={buildSelectUrl(filters, m.id)}
                className={cn(
                  'flex items-center gap-2.5 border-b px-3 py-2.5 transition-colors last:border-0 hover:bg-zinc-50',
                  selectedId === m.id && 'bg-zinc-100'
                )}
              >
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    !m.enrollment
                      ? 'bg-zinc-300'
                      : m.hasPaid
                        ? 'bg-emerald-500'
                        : 'bg-red-400'
                  )}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-800">{m.fullName}</div>
                  <div className="text-xs text-zinc-400">{m.documentNumber}</div>
                </div>
              </Link>
            ))}
            {rows.length === 0 && (
              <div className="py-8 text-center text-sm text-zinc-400">Sin resultados</div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-2 text-xs text-zinc-500">
              {filters.page > 1 ? (
                <Link
                  href={buildUrl(filters, { page: filters.page - 1 }, selectedId)}
                  className="hover:text-zinc-700"
                >
                  ← Ant.
                </Link>
              ) : (
                <span />
              )}
              <span>{filters.page}/{totalPages}</span>
              {filters.page < totalPages ? (
                <Link
                  href={buildUrl(filters, { page: filters.page + 1 }, selectedId)}
                  className="hover:text-zinc-700"
                >
                  Sig. →
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 overflow-hidden rounded-xl border bg-white">
          {selected ? (
            <div className="h-full overflow-y-auto p-6">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selected.fullName}</h2>
                  <p className="mt-0.5 text-sm text-zinc-500">DNI {selected.documentNumber}</p>
                  <span
                    className={cn(
                      'mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                      selected.active === 'true'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-zinc-100 text-zinc-500'
                    )}
                  >
                    {selected.active === 'true' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/members/${selected.id}`}
                    className="text-sm text-zinc-600 underline hover:text-zinc-900"
                  >
                    Ver perfil completo
                  </Link>
                  <MemberActionsMenu
                    member={{
                      id: selected.id,
                      fullName: selected.fullName,
                      documentNumber: selected.documentNumber,
                      phone: selected.phone,
                      email: selected.email,
                      birthDate: selected.birthDate,
                      joinedAt: selected.joinedAt,
                      active: selected.active,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Plan">
                  {selected.enrollment ? (
                    <span className="font-medium">{selected.enrollment.planName}</span>
                  ) : (
                    <span className="text-zinc-400">Sin plan</span>
                  )}
                </InfoCard>

                <InfoCard label="Créditos este mes">
                  {selected.enrollment?.planType === 'unlimited' ? (
                    <span className="font-medium">Ilimitado ∞</span>
                  ) : selected.availableCredits != null ? (
                    <span
                      className={cn(
                        'text-lg font-bold',
                        selected.availableCredits <= 0
                          ? 'text-red-600'
                          : selected.availableCredits <= 2
                            ? 'text-amber-600'
                            : 'text-emerald-700'
                      )}
                    >
                      {selected.availableCredits} disp.
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </InfoCard>

                <InfoCard label="Cuota">
                  {selected.enrollment ? (
                    <span
                      className={cn(
                        'font-medium',
                        selected.hasPaid ? 'text-emerald-700' : 'text-red-600'
                      )}
                    >
                      {selected.hasPaid ? '✓ Al día' : '✗ Pendiente'}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </InfoCard>

                <InfoCard label="Último fichaje">
                  <span className="font-medium">{formatDateTime(selected.lastVisit)}</span>
                </InfoCard>

                <InfoCard label="Teléfono">
                  <span className="font-medium">{selected.phone ?? '—'}</span>
                </InfoCard>

                <InfoCard label="Email">
                  <span className="break-all text-sm font-medium">{selected.email ?? '—'}</span>
                </InfoCard>

                <InfoCard label="F. nacimiento">
                  <span className="font-medium">{formatDate(selected.birthDate)}</span>
                </InfoCard>

                <InfoCard label="Fecha de alta">
                  <span className="font-medium">{formatDate(selected.joinedAt)}</span>
                </InfoCard>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div className="text-3xl text-zinc-300">←</div>
              <p className="text-sm text-zinc-400">
                Seleccioná un socio para ver su información
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-4 py-3">
      <div className="mb-1 text-xs font-medium text-zinc-500">{label}</div>
      {children}
    </div>
  )
}
