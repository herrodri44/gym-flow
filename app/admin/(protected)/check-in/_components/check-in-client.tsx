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
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Phase =
  | { name: 'idle' }
  | { name: 'validated'; result: FichajeResult | { status: 'error'; message: string } }
  | { name: 'multiple'; members: MemberSummary[] }
  | { name: 'registering' }
  | { name: 'registered'; wasOverLimit: boolean; memberName: string; creditsLeft: number | null }

function StatusCard({
  color,
  title,
  subtitle,
  children,
}: {
  color: 'green' | 'red' | 'yellow' | 'orange'
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  const colors = {
    green: 'bg-green-50 border-green-300 text-green-900',
    red: 'bg-red-50 border-red-300 text-red-900',
    yellow: 'bg-yellow-50 border-yellow-300 text-yellow-900',
    orange: 'bg-orange-50 border-orange-300 text-orange-900',
  }
  return (
    <div className={cn('rounded-xl border-2 p-6 text-center', colors[color])}>
      <p className="text-2xl font-bold">{title}</p>
      {subtitle && <p className="mt-1 text-sm opacity-75">{subtitle}</p>}
      {children}
    </div>
  )
}

function ResultView({
  result,
  onRegister,
  onReset,
  isPending,
}: {
  result: FichajeResult | { status: 'error'; message: string }
  onRegister: (memberId: string) => void
  onReset: () => void
  isPending: boolean
}) {
  if (result.status === 'not_found') {
    return (
      <StatusCard color="red" title="Socio no encontrado">
        <p className="mt-2 text-sm">No encontramos un socio en este gimnasio con ese dato.</p>
        <Button className="mt-4" variant="outline" onClick={onReset}>
          Buscar de nuevo
        </Button>
      </StatusCard>
    )
  }

  if (result.status === 'error') {
    return (
      <StatusCard color="red" title="Error" subtitle={result.message}>
        <Button className="mt-4" variant="outline" onClick={onReset}>
          Intentar de nuevo
        </Button>
      </StatusCard>
    )
  }

  if (result.status === 'already_today') {
    return (
      <StatusCard
        color="yellow"
        title="Ya registramos tu ingreso hoy"
        subtitle={result.member.fullName}
      >
        <p className="mt-2 text-sm">El socio ya fichó hoy en este gimnasio.</p>
        <Button className="mt-4" variant="outline" onClick={onReset}>
          Buscar otro socio
        </Button>
      </StatusCard>
    )
  }

  if (result.status === 'no_active_enrollment') {
    return (
      <StatusCard
        color="orange"
        title="Sin plan activo"
        subtitle={result.member.fullName}
      >
        <p className="mt-2 text-sm">El socio no tiene una inscripción activa.</p>
        <Button className="mt-4" variant="outline" onClick={onReset}>
          Buscar otro socio
        </Button>
      </StatusCard>
    )
  }

  if (result.status === 'over_limit_denied') {
    return (
      <StatusCard
        color="red"
        title="No puede pasar"
        subtitle={result.member.fullName}
      >
        <p className="mt-2 text-sm">El socio no tiene créditos disponibles y el gimnasio no permite ingreso por encima del límite.</p>
        <Button className="mt-4" variant="outline" onClick={onReset}>
          Buscar otro socio
        </Button>
      </StatusCard>
    )
  }

  if (result.status === 'ok') {
    const creditsText =
      result.creditsLeft === null
        ? 'Plan libre'
        : `${result.creditsLeft} crédito${result.creditsLeft === 1 ? '' : 's'} disponible${result.creditsLeft === 1 ? '' : 's'}`

    return (
      <StatusCard
        color="green"
        title="Puede pasar"
        subtitle={result.member.fullName}
      >
        <p className="mt-2 text-sm font-medium">{creditsText}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={onReset}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onRegister(result.member.id)}
            disabled={isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {isPending ? 'Registrando…' : 'Registrar fichaje'}
          </Button>
        </div>
      </StatusCard>
    )
  }

  if (result.status === 'over_limit_allowed') {
    return (
      <StatusCard
        color="yellow"
        title="Sin créditos — ingreso permitido"
        subtitle={result.member.fullName}
      >
        <p className="mt-2 text-sm">El socio no tiene créditos disponibles pero el gimnasio permite el ingreso con advertencia.</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={onReset}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onRegister(result.member.id)}
            disabled={isPending}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            {isPending ? 'Registrando…' : 'Registrar de todas formas'}
          </Button>
        </div>
      </StatusCard>
    )
  }

  // multiple_matches: should not reach here (handled separately)
  return null
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
        // Re-validation revealed a different status (race condition) — show it
        setPhase({ name: 'validated', result })
      }
    })
  }

  // ─── Registered screen ────────────────────────────────────────────────────
  if (phase.name === 'registered') {
    const creditsText =
      phase.creditsLeft === null
        ? 'Plan libre'
        : `Créditos restantes: ${Math.max(0, phase.creditsLeft - 1)}`

    return (
      <div className="mx-auto max-w-md space-y-6">
        <div
          className={cn(
            'rounded-2xl border-4 p-10 text-center',
            phase.wasOverLimit
              ? 'bg-yellow-50 border-yellow-400 text-yellow-900'
              : 'bg-green-50 border-green-400 text-green-900',
          )}
        >
          <p className="text-5xl font-black">
            {phase.wasOverLimit ? '⚠ Advertencia' : '✓ Ingresó'}
          </p>
          <p className="mt-4 text-xl font-semibold">{phase.memberName}</p>
          <p className="mt-2 text-sm opacity-75">{creditsText}</p>
          {phase.wasOverLimit && (
            <p className="mt-3 text-sm font-medium">
              Ingresó sin créditos disponibles.
            </p>
          )}
        </div>
        <div className="text-center">
          <Button onClick={reset} size="lg">
            Nuevo fichaje
          </Button>
        </div>
      </div>
    )
  }

  // ─── Multiple matches screen ───────────────────────────────────────────────
  if (phase.name === 'multiple') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="mb-3 font-medium text-sm text-zinc-600">
            Se encontraron {phase.members.length} socios. Seleccioná uno:
          </p>
          <ul className="divide-y">
            {phase.members.map((m) => (
              <li key={m.id}>
                <button
                  className="w-full py-3 px-2 text-left hover:bg-zinc-50 rounded transition-colors disabled:opacity-50"
                  onClick={() => handleSelectMember(m)}
                  disabled={isPending}
                >
                  <span className="font-medium">{m.fullName}</span>
                  <span className="ml-2 text-sm text-zinc-500">DNI {m.documentNumber}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-center">
          <Button variant="outline" onClick={reset} disabled={isPending}>
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  // ─── Validated result screen ───────────────────────────────────────────────
  if (phase.name === 'validated') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <ResultView
          result={phase.result}
          onRegister={handleRegister}
          onReset={reset}
          isPending={isPending}
        />
      </div>
    )
  }

  // ─── Idle (search form) ────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSearch} className="mx-auto max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ci-query">Número de documento o nombre del socio</Label>
        <Input
          id="ci-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej: 35123456 o Juan Pérez"
          autoFocus
          autoComplete="off"
          disabled={isPending}
        />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={isPending || !query.trim()}>
        {isPending ? 'Buscando…' : 'Buscar y validar'}
      </Button>
    </form>
  )
}
