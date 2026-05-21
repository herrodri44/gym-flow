'use client'

import { useState, useTransition } from 'react'
import {
  searchFichajeAction,
  validateMemberFichajeAction,
  registerFichajeAction,
} from '../actions'
import type { FichajeResult, MemberSummary } from '@/lib/domain/fichaje'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ErrorResult = { status: 'error'; message: string }

type Phase =
  | { name: 'idle' }
  | { name: 'validated'; result: FichajeResult | ErrorResult }
  | { name: 'multiple'; members: MemberSummary[] }
  | { name: 'registered'; wasOverLimit: boolean; memberName: string; creditsLeft: number | null }

const STEPS = ['Buscar', 'Confirmar', 'Resultado']

function StepBar({ current }: { current: 0 | 1 | 2 }) {
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map((label, i) => (
        <div key={i} className={cn('flex items-center', i < STEPS.length - 1 ? 'flex-1' : '')}>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-200',
                i < current
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : i === current
                    ? 'border-zinc-900 bg-white text-zinc-900'
                    : 'border-zinc-200 bg-white text-zinc-300'
              )}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span
              className={cn(
                'text-xs font-medium',
                i <= current ? 'text-zinc-700' : 'text-zinc-300'
              )}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'mb-5 mx-2 h-0.5 flex-1 transition-all duration-300',
                i < current ? 'bg-zinc-900' : 'bg-zinc-200'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function ConfirmCard({
  result,
  isPending,
  onRegister,
  onReset,
}: {
  result:
    | { status: 'ok'; member: { id: string; fullName: string; documentNumber: string }; creditsLeft: number | null }
    | { status: 'over_limit_allowed'; member: { id: string; fullName: string; documentNumber: string } }
  isPending: boolean
  onRegister: (id: string) => void
  onReset: () => void
}) {
  const isWarn = result.status === 'over_limit_allowed'
  const creditsLeft = result.status === 'ok' ? result.creditsLeft : null

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div
        className={cn(
          'border-b p-5',
          isWarn ? 'border-amber-100 bg-amber-50' : 'border-emerald-100 bg-emerald-50'
        )}
      >
        <div className={cn('text-2xl font-bold', isWarn ? 'text-amber-800' : 'text-emerald-800')}>
          {isWarn ? '⚠ Sin créditos — ingreso permitido' : '✓ Puede ingresar'}
        </div>
        <div className="mt-1 text-sm text-zinc-600">Revisá los datos antes de confirmar</div>
      </div>

      <div className="space-y-4 p-5">
        <div className="rounded-xl bg-zinc-50 px-4 py-3 space-y-2.5">
          <InfoRow label="Nombre" value={result.member.fullName} bold />
          <InfoRow label="Documento" value={result.member.documentNumber} />
          {creditsLeft !== null ? (
            <InfoRow
              label="Créditos disponibles"
              value={String(creditsLeft)}
              valueClass={creditsLeft <= 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}
            />
          ) : (
            <InfoRow label="Plan" value="Libre ∞" valueClass="text-emerald-700 font-medium" />
          )}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:grid sm:grid-cols-2">
          <Button variant="outline" onClick={onReset} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => onRegister(result.member.id)}
            disabled={isPending}
            className={cn('h-12', isWarn ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700')}
          >
            {isPending ? 'Registrando…' : 'Confirmar ingreso'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  bold,
  valueClass,
}: {
  label: string
  value: string
  bold?: boolean
  valueClass?: string
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className={cn(bold ? 'font-semibold' : 'font-medium', valueClass)}>{value}</span>
    </div>
  )
}

function ErrorCard({
  result,
  onReset,
}: {
  result: { status: string; message?: string; member?: { fullName: string } }
  onReset: () => void
}) {
  const cfg: Record<string, { border: string; bg: string; iconColor: string; icon: string; title: string; sub?: string }> = {
    not_found: {
      border: 'border-red-200', bg: 'bg-red-50', iconColor: 'text-red-400',
      icon: '✗', title: 'Socio no encontrado', sub: 'No existe un socio con ese dato.',
    },
    error: {
      border: 'border-red-200', bg: 'bg-red-50', iconColor: 'text-red-400',
      icon: '!', title: 'Error',
    },
    already_today: {
      border: 'border-amber-200', bg: 'bg-amber-50', iconColor: 'text-amber-400',
      icon: '↺', title: 'Ya fichó hoy',
    },
    no_active_enrollment: {
      border: 'border-orange-200', bg: 'bg-orange-50', iconColor: 'text-orange-400',
      icon: '—', title: 'Sin plan activo',
    },
    over_limit_denied: {
      border: 'border-red-200', bg: 'bg-red-50', iconColor: 'text-red-400',
      icon: '✗', title: 'No puede pasar', sub: 'Sin créditos disponibles',
    },
  }

  const c = cfg[result.status]
  if (!c) return null
  const sub = c.sub ?? result.message ?? result.member?.fullName

  return (
    <div className={cn('rounded-2xl border p-8 text-center shadow-sm space-y-3', c.border, c.bg)}>
      <div className={cn('text-5xl font-black', c.iconColor)}>{c.icon}</div>
      <div className="text-xl font-bold text-zinc-900">{c.title}</div>
      {sub && <div className="text-sm text-zinc-600">{sub}</div>}
      <Button variant="outline" className="mt-2 w-full" onClick={onReset}>
        ← Buscar de nuevo
      </Button>
    </div>
  )
}

export function CheckInClient() {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const [isPending, startTransition] = useTransition()

  function reset() {
    setPhase({ name: 'idle' })
    setQuery('')
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    startTransition(async () => {
      const result = await searchFichajeAction(query)
      if (result.status === 'multiple_matches') {
        setPhase({ name: 'multiple', members: result.members })
      } else {
        setPhase({ name: 'validated', result })
      }
    })
  }

  function handleSelectMember(member: MemberSummary) {
    startTransition(async () => {
      const result = await validateMemberFichajeAction(member.id)
      setPhase({ name: 'validated', result })
    })
  }

  function handleRegister(memberId: string) {
    startTransition(async () => {
      const result = await registerFichajeAction(memberId)
      if (result.status === 'registered') {
        setPhase({ name: 'registered', ...result })
      } else {
        setPhase({ name: 'validated', result: result as FichajeResult | ErrorResult })
      }
    })
  }

  const currentStep: 0 | 1 | 2 =
    phase.name === 'idle' || phase.name === 'multiple'
      ? 0
      : phase.name === 'validated' &&
          (phase.result.status === 'ok' || phase.result.status === 'over_limit_allowed')
        ? 1
        : 2

  return (
    <div className="mx-auto max-w-lg">
      <StepBar current={currentStep} />

      {/* Step 0a: search form */}
      {phase.name === 'idle' && (
        <form onSubmit={handleSearch} className="rounded-2xl border bg-white p-6 shadow-sm space-y-5">
          <div>
            <div className="text-lg font-semibold text-zinc-900">¿Quién ingresa?</div>
            <div className="mt-1 text-sm text-zinc-500">
              Ingresá el número de documento o nombre completo
            </div>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej: 35123456 o Juan Pérez"
            autoFocus
            autoComplete="off"
            disabled={isPending}
            className="h-12 px-4 text-lg"
          />
          <Button
            type="submit"
            className="h-12 w-full text-base"
            disabled={isPending || !query.trim()}
          >
            {isPending ? 'Buscando…' : 'Buscar →'}
          </Button>
        </form>
      )}

      {/* Step 0b: multiple matches */}
      {phase.name === 'multiple' && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
          <div>
            <div className="text-lg font-semibold text-zinc-900">Varios resultados</div>
            <div className="mt-1 text-sm text-zinc-500">
              Se encontraron {phase.members.length} socios. Seleccioná uno:
            </div>
          </div>
          <ul className="divide-y overflow-hidden rounded-xl border">
            {phase.members.map((m) => (
              <li key={m.id}>
                <button
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 disabled:opacity-50"
                  onClick={() => handleSelectMember(m)}
                  disabled={isPending}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600">
                    {m.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-900">{m.fullName}</div>
                    <div className="text-xs text-zinc-400">DNI {m.documentNumber}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="w-full" onClick={reset} disabled={isPending}>
            ← Buscar de nuevo
          </Button>
        </div>
      )}

      {/* Step 1: confirmation (ok / over_limit_allowed) */}
      {phase.name === 'validated' &&
        (phase.result.status === 'ok' || phase.result.status === 'over_limit_allowed') && (
          <ConfirmCard
            result={
              phase.result as
                | { status: 'ok'; member: { id: string; fullName: string; documentNumber: string }; creditsLeft: number | null }
                | { status: 'over_limit_allowed'; member: { id: string; fullName: string; documentNumber: string } }
            }
            isPending={isPending}
            onRegister={handleRegister}
            onReset={reset}
          />
        )}

      {/* Step 2a: registered */}
      {phase.name === 'registered' && (
        <div
          className={cn(
            'rounded-2xl border p-8 text-center shadow-sm space-y-3',
            phase.wasOverLimit ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
          )}
        >
          <div
            className={cn(
              'text-7xl font-black',
              phase.wasOverLimit ? 'text-amber-400' : 'text-emerald-400'
            )}
          >
            {phase.wasOverLimit ? '⚠' : '✓'}
          </div>
          <div
            className={cn(
              'text-2xl font-bold',
              phase.wasOverLimit ? 'text-amber-900' : 'text-emerald-900'
            )}
          >
            {phase.wasOverLimit ? 'Ingresó con advertencia' : '¡Ingresó con éxito!'}
          </div>
          <div className="text-lg text-zinc-700">{phase.memberName}</div>
          {phase.creditsLeft !== null && (
            <div className="text-sm text-zinc-500">
              {Math.max(0, phase.creditsLeft - 1)} crédito{phase.creditsLeft - 1 === 1 ? '' : 's'} restante{phase.creditsLeft - 1 === 1 ? '' : 's'}
            </div>
          )}
          <Button className="mt-4 w-full h-12 text-base" onClick={reset}>
            Nuevo fichaje
          </Button>
        </div>
      )}

      {/* Step 2b: error / denial outcomes */}
      {phase.name === 'validated' &&
        !['ok', 'over_limit_allowed'].includes(phase.result.status) && (
          <ErrorCard result={phase.result} onReset={reset} />
        )}
    </div>
  )
}
