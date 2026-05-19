'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { registerPaymentAction } from '../actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface MemberOption {
  id: string
  fullName: string
  documentNumber: string
  enrollmentId: string | null
  planName: string | null
  priceArs: number | null
}

type ActionState = { error?: string; success?: boolean } | undefined

export function RegisterPaymentDialog({ members }: { members: MemberOption[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<MemberOption | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_, fd) => {
      const result = await registerPaymentAction(fd)
      if (result?.success) {
        setOpen(false)
      }
      return result
    },
    undefined
  )

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelectedMember(null)
      setShowDropdown(false)
    }
  }, [open])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = query.length < 1
    ? []
    : members
        .filter((m) => {
          const q = query.toLowerCase()
          return m.fullName.toLowerCase().includes(q) || m.documentNumber.includes(q)
        })
        .slice(0, 8)

  function handleSelect(member: MemberOption) {
    setSelectedMember(member)
    setQuery(member.fullName)
    setShowDropdown(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setSelectedMember(null)
    setShowDropdown(true)
  }

  const defaultAmount = selectedMember?.priceArs
    ? (selectedMember.priceArs / 100).toFixed(0)
    : ''

  const currentMonth = new Date().toISOString().slice(0, 7)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants())}>
        Registrar pago
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">

          {/* Member combobox */}
          <div className="space-y-1.5" ref={containerRef}>
            <Label htmlFor="rp-member-query">Socio</Label>
            <div className="relative">
              <Input
                id="rp-member-query"
                value={query}
                onChange={handleInputChange}
                onFocus={() => query.length > 0 && setShowDropdown(true)}
                placeholder="Buscar por nombre o DNI..."
                autoComplete="off"
              />
              {showDropdown && filtered.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-52 overflow-y-auto">
                  {filtered.map((m) => (
                    <li
                      key={m.id}
                      onMouseDown={() => handleSelect(m)}
                      className="flex items-baseline gap-1.5 px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50"
                    >
                      <span className="font-medium text-zinc-900">{m.fullName}</span>
                      <span className="text-zinc-400 text-xs">({m.documentNumber})</span>
                      {m.planName && (
                        <span className="text-zinc-400 text-xs ml-auto shrink-0">
                          {m.planName}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {showDropdown && query.length >= 2 && filtered.length === 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-sm px-3 py-2 text-sm text-zinc-400">
                  Sin resultados
                </div>
              )}
            </div>
            {selectedMember && (
              <input type="hidden" name="memberId" value={selectedMember.id} />
            )}
          </div>

          {selectedMember?.enrollmentId && (
            <input type="hidden" name="enrollmentId" value={selectedMember.enrollmentId} />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rp-month">Período</Label>
            <Input
              id="rp-month"
              name="month"
              type="month"
              defaultValue={currentMonth}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rp-amount">Monto ($ ARS)</Label>
            <Input
              id="rp-amount"
              name="amountArs"
              type="number"
              min="0"
              step="1"
              key={selectedMember?.id ?? 'empty'}
              defaultValue={defaultAmount}
              placeholder="30000"
              required
            />
            {selectedMember?.planName && (
              <p className="text-xs text-zinc-400">Plan: {selectedMember.planName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rp-status">Estado</Label>
            <select
              id="rp-status"
              name="status"
              defaultValue="paid"
              className="w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="paid">Pagado</option>
              <option value="pending">Pendiente</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rp-notes">Notas (opcional)</Label>
            <Input id="rp-notes" name="notes" placeholder="Efectivo, transferencia..." />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !selectedMember}>
              {pending ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
