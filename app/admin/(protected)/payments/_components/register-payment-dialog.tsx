'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { registerPaymentAction } from '../actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, centavosToPesos, formatARS } from '@/lib/utils'
import { addDays, calculateNextPeriod } from '@/lib/domain/period-math'
import { STANDING_LABEL, formatDay } from '@/lib/standing-ui'
import type { MemberPaymentOption, PlanOption } from '@/lib/domain/payments'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type ActionState = Awaited<ReturnType<typeof registerPaymentAction>> | undefined

type Props = {
  members: MemberPaymentOption[]
  plans: PlanOption[]
  today: string
  /** Fixes the member (member detail page) and hides the picker. */
  fixedMember?: MemberPaymentOption
  triggerLabel?: string
  triggerVariant?: 'default' | 'outline'
  triggerSize?: 'default' | 'sm'
}

export function RegisterPaymentDialog({
  members,
  plans,
  today,
  fixedMember,
  triggerLabel = 'Registrar pago',
  triggerVariant = 'default',
  triggerSize = 'default',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<MemberPaymentOption | null>(fixedMember ?? null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [planId, setPlanId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(today)
  const [editStart, setEditStart] = useState(false)
  const [startOverride, setStartOverride] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (_, fd) => {
    const result = await registerPaymentAction(fd)
    if ('success' in result) setOpen(false)
    return result
  }, undefined)

  function selectPlanFor(member: MemberPaymentOption | null) {
    const plan = plans.find((p) => p.id === member?.lastPlanId) ?? plans[0]
    setPlanId(plan?.id ?? '')
    setAmount(plan ? String(centavosToPesos(plan.priceArs)) : '')
  }

  function handleOpenChange(next: boolean) {
    // Start fresh every time the dialog opens
    if (next) {
      const member = fixedMember ?? null
      setQuery('')
      setSelectedMember(member)
      setShowDropdown(false)
      setPaymentDate(today)
      setEditStart(false)
      setStartOverride('')
      selectPlanFor(member)
    }
    setOpen(next)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered =
    query.length < 1
      ? []
      : members
          .filter((m) => {
            const q = query.toLowerCase()
            return m.fullName.toLowerCase().includes(q) || m.documentNumber.includes(q)
          })
          .slice(0, 8)

  function handleSelect(member: MemberPaymentOption) {
    setSelectedMember(member)
    setQuery(member.fullName)
    setShowDropdown(false)
    setEditStart(false)
    setStartOverride('')
    selectPlanFor(member)
  }

  function handlePlanChange(id: string) {
    setPlanId(id)
    const plan = plans.find((p) => p.id === id)
    if (plan) setAmount(String(centavosToPesos(plan.priceArs)))
  }

  // Same calculation the server runs — the preview is what gets saved.
  const preview = useMemo(() => {
    if (!selectedMember) return null
    const lastPeriod =
      selectedMember.lastPeriodEnd && selectedMember.lastAnchorDay
        ? { endDate: selectedMember.lastPeriodEnd, anchorDay: selectedMember.lastAnchorDay }
        : null
    return {
      lastPeriod,
      result: calculateNextPeriod({
        lastPeriod,
        paymentDate,
        startOverride: editStart && startOverride ? startOverride : undefined,
      }),
    }
  }, [selectedMember, paymentDate, editStart, startOverride])

  const queued =
    preview && !('error' in preview.result) && preview.lastPeriod && preview.result.startDate === preview.lastPeriod.endDate && preview.result.startDate > today

  const selectedPlan = plans.find((p) => p.id === planId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={cn(buttonVariants({ variant: triggerVariant, size: triggerSize }))}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {fixedMember ? (
            <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm">
              <span className="font-medium">{fixedMember.fullName}</span>
              <span className="ml-2 text-zinc-400">{STANDING_LABEL[fixedMember.status]}</span>
            </div>
          ) : (
            <div className="space-y-1.5" ref={containerRef}>
              <Label htmlFor="rp-member-query">Socio</Label>
              <div className="relative">
                <Input
                  id="rp-member-query"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelectedMember(null)
                    setShowDropdown(true)
                  }}
                  onFocus={() => query.length > 0 && setShowDropdown(true)}
                  placeholder="Buscar por nombre o DNI..."
                  autoComplete="off"
                />
                {showDropdown && filtered.length > 0 && (
                  <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
                    {filtered.map((m) => (
                      <li
                        key={m.id}
                        onMouseDown={() => handleSelect(m)}
                        className="flex cursor-pointer items-baseline gap-1.5 px-3 py-2 text-sm hover:bg-zinc-50"
                      >
                        <span className="font-medium text-zinc-900">{m.fullName}</span>
                        <span className="text-xs text-zinc-400">({m.documentNumber})</span>
                        <span className="ml-auto shrink-0 text-xs text-zinc-400">{STANDING_LABEL[m.status]}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {showDropdown && query.length >= 2 && filtered.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-400 shadow-sm">
                    Sin resultados
                  </div>
                )}
              </div>
            </div>
          )}
          {selectedMember && <input type="hidden" name="memberId" value={selectedMember.id} />}

          <div className="space-y-1.5">
            <Label htmlFor="rp-plan">Plan</Label>
            <select
              id="rp-plan"
              name="planId"
              value={planId}
              onChange={(e) => handlePlanChange(e.target.value)}
              required
              className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              {plans.length === 0 && <option value="">No hay planes activos</option>}
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatARS(p.priceArs)}
                  {p.planType === 'credits' ? ` · ${p.creditsPerMonth} créditos` : ' · libre'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rp-amount">Monto ($ ARS)</Label>
              <Input
                id="rp-amount"
                name="amountArs"
                type="number"
                min="0"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-date">Fecha de pago</Label>
              <Input
                id="rp-date"
                name="paymentDate"
                type="date"
                max={today}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
          </div>

          {preview && (
            <div className="space-y-2 rounded-md border bg-zinc-50 px-3 py-2.5 text-sm">
              {'error' in preview.result ? (
                <p className="text-red-600">
                  {preview.result.error === 'overlaps_previous_period'
                    ? `El inicio no puede ser anterior al ${formatDay(preview.lastPeriod?.endDate)}.`
                    : 'Fecha inválida.'}
                </p>
              ) : (
                <>
                  <p>
                    <span className="text-zinc-500">Período:</span>{' '}
                    <span className="font-medium">
                      {formatDay(preview.result.startDate)} → {formatDay(addDays(preview.result.endDate, -1))}
                    </span>
                  </p>
                  {selectedPlan && (
                    <p className="text-xs text-zinc-500">
                      {selectedPlan.planType === 'credits'
                        ? `${selectedPlan.creditsPerMonth} créditos válidos hasta el ${formatDay(addDays(preview.result.endDate, -1))}. Próximo pago: ${formatDay(preview.result.endDate)}.`
                        : `Acceso libre hasta el ${formatDay(addDays(preview.result.endDate, -1))}.`}
                    </p>
                  )}
                  {queued && (
                    <p className="text-xs text-sky-700">
                      Renovación anticipada: empieza cuando termina el período actual.
                    </p>
                  )}
                </>
              )}
              {editStart ? (
                <div className="flex items-center gap-2 pt-1">
                  <Label htmlFor="rp-start" className="shrink-0 text-xs text-zinc-500">Inicio</Label>
                  <Input
                    id="rp-start"
                    name="startDate"
                    type="date"
                    value={startOverride}
                    onChange={(e) => setStartOverride(e.target.value)}
                    className="h-8"
                  />
                  <button
                    type="button"
                    className="shrink-0 text-xs text-zinc-500 underline"
                    onClick={() => {
                      setEditStart(false)
                      setStartOverride('')
                    }}
                  >
                    Automático
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs text-zinc-500 underline"
                  onClick={() => {
                    setEditStart(true)
                    if (!('error' in preview.result)) setStartOverride(preview.result.startDate)
                  }}
                >
                  Cambiar fecha de inicio
                </button>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rp-notes">Notas (opcional)</Label>
            <Input id="rp-notes" name="notes" placeholder="Efectivo, transferencia..." />
          </div>

          {state && 'error' in state && <p className="text-sm text-red-600">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={pending || !selectedMember || !planId || (preview !== null && 'error' in preview.result)}
            >
              {pending ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
