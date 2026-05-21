'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MemberActionsMenu } from './member-actions-menu'
import type { MemberRow, MembersListFilters } from '@/lib/domain/members-list'

function buildUrl(
  filters: MembersListFilters,
  overrides: Partial<MembersListFilters> = {},
) {
  const merged = { ...filters, ...overrides }
  const params = new URLSearchParams()
  if (merged.q) params.set('q', merged.q)
  if (merged.status !== 'active') params.set('status', merged.status)
  if (merged.payment !== 'all') params.set('payment', merged.payment)
  if ((merged.page ?? 1) > 1) params.set('page', String(merged.page))
  const qs = params.toString()
  return `/admin/members${qs ? '?' + qs : ''}`
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

function InfoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-4 py-3">
      <div className="mb-1 text-xs font-medium text-zinc-500">{label}</div>
      {children}
    </div>
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

type Props = {
  rows: MemberRow[]
  filters: MembersListFilters
  total: number
  totalPages: number
}

function SearchBar({ filters }: { filters: MembersListFilters }) {
  return (
    <form method="get" className="flex gap-1.5">
      <input type="hidden" name="status" value={filters.status} />
      <input type="hidden" name="payment" value={filters.payment} />
      <Input name="q" defaultValue={filters.q} placeholder="Buscar…" className="h-8 flex-1 text-sm" />
      <Button type="submit" variant="outline" size="sm" className="h-8 px-2 text-xs">Ir</Button>
    </form>
  )
}

function Pagination({ filters, totalPages }: { filters: MembersListFilters; totalPages: number }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t p-2 text-xs text-zinc-500">
      {filters.page > 1
        ? <Link href={buildUrl(filters, { page: filters.page - 1 })} className="hover:text-zinc-700">← Ant.</Link>
        : <span />}
      <span>{filters.page}/{totalPages}</span>
      {filters.page < totalPages
        ? <Link href={buildUrl(filters, { page: filters.page + 1 })} className="hover:text-zinc-700">Sig. →</Link>
        : <span />}
    </div>
  )
}

function statusDot(m: MemberRow) {
  return !m.enrollment ? 'bg-zinc-300' : m.hasPaid ? 'bg-emerald-500' : 'bg-red-400'
}

export function MembersSplitPanel({ rows, filters, totalPages }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = rows.find((m) => m.id === selectedId) ?? null

  return (
    <div className="space-y-4">
      {/* Filters — stack on mobile, row on desktop */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide mr-1">Estado</span>
          {STATUS_TABS.map((tab) => (
            <Link key={tab.value} href={buildUrl(filters, { status: tab.value, page: 1 })}
              className={cn('rounded-full px-3 py-1 text-sm font-medium transition-colors',
                filters.status === tab.value ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}>{tab.label}</Link>
          ))}
        </div>
        <div className="hidden sm:block w-px self-stretch bg-zinc-200" />
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide mr-1">Cuota</span>
          {PAYMENT_TABS.map((tab) => (
            <Link key={tab.value} href={buildUrl(filters, { payment: tab.value, page: 1 })}
              className={cn('rounded-full px-3 py-1 text-sm font-medium transition-colors',
                filters.payment === tab.value ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}>{tab.label}</Link>
          ))}
        </div>
      </div>

      {/* Mobile: linked list */}
      <div className="sm:hidden flex flex-col overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-3"><SearchBar filters={filters} /></div>
        <div>
          {rows.map((m) => (
            <Link key={m.id} href={`/admin/members/${m.id}`}
              className="flex items-center gap-3 border-b px-4 py-3.5 last:border-0 hover:bg-zinc-50"
            >
              <span className={cn('size-2 shrink-0 rounded-full', statusDot(m))} />
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium text-zinc-800">{m.fullName}</div>
                <div className="text-xs text-zinc-400">DNI {m.documentNumber}</div>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                {m.enrollment && (
                  <span className={cn('text-xs font-medium', m.hasPaid ? 'text-emerald-600' : 'text-red-500')}>
                    {m.hasPaid ? 'Al día' : 'Pendiente'}
                  </span>
                )}
                {m.enrollment?.planType !== 'unlimited' && m.availableCredits != null && (
                  <span className="text-xs text-zinc-400">{m.availableCredits} créd.</span>
                )}
              </div>
              <ChevronRight className="size-4 text-zinc-300 shrink-0" />
            </Link>
          ))}
          {rows.length === 0 && <div className="py-8 text-center text-sm text-zinc-400">Sin resultados</div>}
        </div>
        <Pagination filters={filters} totalPages={totalPages} />
      </div>

      {/* Desktop: split panel */}
      <div className="hidden sm:flex h-[70vh] min-h-96 gap-4">
        {/* Left: list */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-3"><SearchBar filters={filters} /></div>
          <div className="flex-1 overflow-y-auto">
            {rows.map((m) => (
              <button key={m.id} onClick={() => setSelectedId(m.id)}
                className={cn('flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-zinc-50',
                  selectedId === m.id && 'bg-zinc-100'
                )}
              >
                <span className={cn('size-2 shrink-0 rounded-full', statusDot(m))} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-800">{m.fullName}</div>
                  <div className="text-xs text-zinc-400">{m.documentNumber}</div>
                </div>
              </button>
            ))}
            {rows.length === 0 && <div className="py-8 text-center text-sm text-zinc-400">Sin resultados</div>}
          </div>
          <Pagination filters={filters} totalPages={totalPages} />
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 overflow-hidden rounded-xl border bg-white">
          {selected ? (
            <div className="h-full overflow-y-auto p-6">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selected.fullName}</h2>
                  <p className="mt-0.5 text-sm text-zinc-500">DNI {selected.documentNumber}</p>
                  <span className={cn('mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                    selected.active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                  )}>
                    {selected.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/members/${selected.id}`} className="text-sm text-zinc-600 underline hover:text-zinc-900">
                    Ver perfil completo
                  </Link>
                  <MemberActionsMenu member={{
                    id: selected.id, fullName: selected.fullName,
                    documentNumber: selected.documentNumber, phone: selected.phone,
                    email: selected.email, birthDate: selected.birthDate,
                    joinedAt: selected.joinedAt, active: selected.active, notes: selected.notes,
                  }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Plan">
                  {selected.enrollment
                    ? <span className="font-medium">{selected.enrollment.planName}</span>
                    : <span className="text-zinc-400">Sin plan</span>}
                </InfoCard>
                <InfoCard label="Créditos este mes">
                  {selected.enrollment?.planType === 'unlimited'
                    ? <span className="font-medium">Ilimitado ∞</span>
                    : selected.availableCredits != null
                      ? <span className={cn('text-lg font-bold',
                          selected.availableCredits <= 0 ? 'text-red-600'
                          : selected.availableCredits <= 2 ? 'text-amber-600' : 'text-emerald-700'
                        )}>{selected.availableCredits} disp.</span>
                      : <span className="text-zinc-400">—</span>}
                </InfoCard>
                <InfoCard label="Cuota">
                  {selected.enrollment
                    ? <span className={cn('font-medium', selected.hasPaid ? 'text-emerald-700' : 'text-red-600')}>
                        {selected.hasPaid ? '✓ Al día' : '✗ Pendiente'}
                      </span>
                    : <span className="text-zinc-400">—</span>}
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
              <p className="text-sm text-zinc-400">Seleccioná un socio para ver su información</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
