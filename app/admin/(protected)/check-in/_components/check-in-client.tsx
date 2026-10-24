'use client'

import { useState, useTransition } from 'react'
import {
  searchFichajeAction,
  validateMemberFichajeAction,
  registerFichajeAction,
  type RegisteredResult,
} from '../actions'
import type { FichajeResult, MemberFichajeResult, MemberSummary } from '@/lib/domain/fichaje'
import { formatDay } from '@/lib/standing-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ErrorResult = { status: 'error'; message: string }

type Phase =
  | { name: 'idle' }
  | { name: 'validated'; result: FichajeResult | ErrorResult }
  | { name: 'multiple'; members: MemberSummary[] }
  | ({ name: 'registered' } & Omit<RegisteredResult, 'status'>)

type ConfirmableResult = Extract<MemberFichajeResult, { status: 'ok' | 'over_limit_allowed' | 'grace_allowed' }>

function isConfirmable(r: FichajeResult | ErrorResult): r is ConfirmableResult {
  return r.status === 'ok' || r.status === 'over_limit_allowed' || r.status === 'grace_allowed'
}

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
  result: ConfirmableResult
  isPending: boolean
  onRegister: (id: string) => void
  onReset: () => void
}) {
  const isWarn = result.status !== 'ok'
  const title =
    result.status === 'ok'
      ? '✓ Puede ingresar'
      : result.status === 'over_limit_allowed'
        ? '⚠ Sin créditos — ingreso permitido'
        : '⚠ Cuota vencida — en período de gracia'

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div
        className={cn(
          'border-b p-5',
          isWarn ? 'border-amber-100 bg-amber-50' : 'border-emerald-100 bg-emerald-50'
        )}
      >
        <div className={cn('text-2xl font-bold', isWarn ? 'text-amber-800' : 'text-emerald-800')}>{title}</div>
        <div className="mt-1 text-sm text-zinc-600">Revisá los datos antes de confirmar</div>
      </div>

      <div className="space-y-4 p-5">
        <div className="rounded-xl bg-zinc-50 px-4 py-3 space-y-2.5">
          <InfoRow label="Nombre" value={result.member.fullName} bold />
          <InfoRow label="Documento" value={result.member.documentNumber} />
          {result.status === 'ok' &&
            (result.creditsLeft !== null ? (
              <InfoRow
                label="Créditos disponibles"
                value={String(result.creditsLeft)}
                valueClass={result.creditsLeft <= 1 ? 'text-amber-600 font-bold' : 'text-emerald-700 font-bold'}
              />
            ) : (
              <InfoRow label="Plan" value="Libre ∞" valueClass="text-emerald-700 font-medium" />
            ))}
          {result.status !== 'grace_allowed' ? (
            <InfoRow label="Válido hasta" value={formatDay(result.validUntil)} />
          ) : (
            <>
              <InfoRow label="Venció el" value={formatDay(result.expiredOn)} valueClass="text-red-600 font-medium" />
              <InfoRow
                label="Gracia restante"
                value={`${result.graceDaysLeft} ${result.graceDaysLeft === 1 ? 'día' : 'días'}`}
              />
            </>
          )}
        </div>
        {result.status === 'grace_allowed' && (
          <p className="text-sm text-amber-700">
            Recordale que tiene que renovar. Este ingreso se descuenta del próximo período.
          </p>
        )}
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

function errorSub(result: FichajeResult | ErrorResult): string | undefined {
  switch (result.status) {
    case 'error':
      return result.message
    case 'expired':
      return `${result.member.fullName} · venció el ${formatDay(result.expiredOn)}. Tiene que renovar.`
    case 'not_started':
      return `${result.member.fullName} · su período empieza el ${formatDay(result.startsOn)}.`
    case 'over_limit_denied':
      return `${result.member.fullName} · sin créditos hasta el ${formatDay(result.validUntil)}.`
    case 'no_plan':
      return `${result.member.fullName} · todavía no registró ningún pago.`
    case 'already_today':
      return result.member.fullName
    default:
      return undefined
  }
}

function ErrorCard({
  result,
  onReset,
}: {
  result: FichajeResult | ErrorResult
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
    no_plan: {
      border: 'border-orange-200', bg: 'bg-orange-50', iconColor: 'text-orange-400',
      icon: '—', title: 'Sin plan',
    },
    expired: {
      border: 'border-red-200', bg: 'bg-red-50', iconColor: 'text-red-400',
      icon: '✗', title: 'Cuota vencida',
    },
    not_started: {
      border: 'border-sky-200', bg: 'bg-sky-50', iconColor: 'text-sky-400',
      icon: '…', title: 'Período sin empezar',
    },
    over_limit_denied: {
      border: 'border-red-200', bg: 'bg-red-50', iconColor: 'text-red-400',
      icon: '✗', title: 'No puede pasar — sin créditos',
    },
  }

  const c = cfg[result.status]
  if (!c) return null
  const sub = c.sub ?? errorSub(result)

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
        setPhase({
          name: 'registered',
          outcome: result.outcome,
          memberName: result.memberName,
          creditsLeft: result.creditsLeft,
          validUntil: result.validUntil,
        })
      } else {
        setPhase({ name: 'validated', result })
      }
    })
  }

  const currentStep: 0 | 1 | 2 =
    phase.name === 'idle' || phase.name === 'multiple'
      ? 0
      : phase.name === 'validated' && isConfirmable(phase.result)
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
      {phase.name === 'validated' && isConfirmable(phase.result) && (
          <ConfirmCard
            result={phase.result}
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
            (phase.outcome !== 'ok') ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
          )}
        >
          <div
            className={cn(
              'text-7xl font-black',
              (phase.outcome !== 'ok') ? 'text-amber-400' : 'text-emerald-400'
            )}
          >
            {(phase.outcome !== 'ok') ? '⚠' : '✓'}
          </div>
          <div
            className={cn(
              'text-2xl font-bold',
              (phase.outcome !== 'ok') ? 'text-amber-900' : 'text-emerald-900'
            )}
          >
            {(phase.outcome !== 'ok') ? 'Ingresó con advertencia' : '¡Ingresó con éxito!'}
          </div>
          <div className="text-lg text-zinc-700">{phase.memberName}</div>
          {phase.creditsLeft !== null && (
            <div className="text-sm text-zinc-500">
              {Math.max(0, phase.creditsLeft)} crédito{phase.creditsLeft === 1 ? '' : 's'} restante{phase.creditsLeft === 1 ? '' : 's'}
              {phase.validUntil && ` · válido hasta ${formatDay(phase.validUntil)}`}
            </div>
          )}
          {phase.outcome === 'grace_allowed' && (
            <div className="text-sm text-amber-800">Cuota vencida: recordale que renueve.</div>
          )}
          <Button className="mt-4 w-full h-12 text-base" onClick={reset}>
            Nuevo fichaje
          </Button>
        </div>
      )}

      {/* Step 2b: error / denial outcomes */}
      {phase.name === 'validated' && !isConfirmable(phase.result) && (
          <ErrorCard result={phase.result} onReset={reset} />
        )}
    </div>
  )
}
