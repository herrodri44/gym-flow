'use client'

import { useActionState } from 'react'
import { createCreditAdjustmentAction } from '../../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ActionState = { error?: string; success?: boolean } | undefined

export function CreditAdjustmentForm({ memberId }: { memberId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_, fd) => createCreditAdjustmentAction(fd),
    undefined
  )

  const today = new Date().toISOString().split('T')[0]

  return (
    <form action={formAction} className="rounded-lg border bg-white p-4 space-y-4 max-w-md">
      <input type="hidden" name="memberId" value={memberId} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="adj-amount">Créditos (+/-)</Label>
          <Input
            id="adj-amount"
            name="amount"
            type="number"
            placeholder="-1 o +1"
            required
          />
          <p className="text-xs text-zinc-400">Positivo suma, negativo resta</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adj-date">Fecha</Label>
          <Input id="adj-date" name="date" type="date" defaultValue={today} required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="adj-notes">Nota (opcional)</Label>
        <Input id="adj-notes" name="notes" placeholder="Ej: entró sin fichar el lunes" />
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state?.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Ajuste registrado.</p>
      )}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Guardando…' : 'Registrar ajuste'}
      </Button>
    </form>
  )
}
