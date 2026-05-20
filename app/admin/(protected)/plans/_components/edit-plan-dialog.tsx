'use client'

import { useActionState, useState } from 'react'
import { updatePlanAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Plan {
  id: string
  name: string
  planType: 'credits' | 'unlimited'
  priceArs: number
  creditsPerMonth: number | null
  description: string | null
  active: boolean
}

interface EditPlanDialogProps {
  plan: Plan
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ActionState = { error?: string; success?: boolean } | undefined

export function EditPlanDialog({ plan, open, onOpenChange }: EditPlanDialogProps) {
  const [planType, setPlanType] = useState<'credits' | 'unlimited'>(plan.planType)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_, fd) => {
      fd.set('planType', planType)
      const result = await updatePlanAction(plan.id, fd)
      if (result?.success) onOpenChange(false)
      return result
    },
    undefined
  )

  // Price stored in centavos, display as pesos
  const priceInPesos = Math.round(plan.priceArs / 100)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar plan</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Nombre del plan</Label>
            <Input id="ep-name" name="name" defaultValue={plan.name} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-planType">Tipo</Label>
            <Select value={planType} onValueChange={(v) => setPlanType((v ?? 'credits') as 'credits' | 'unlimited')}>
              <SelectTrigger id="ep-planType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credits">Por créditos</SelectItem>
                <SelectItem value="unlimited">Libre (ilimitado)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-priceArs">Precio ($ ARS)</Label>
            <Input
              id="ep-priceArs"
              name="priceArs"
              type="number"
              min="0"
              step="1"
              defaultValue={priceInPesos}
              required
            />
          </div>

          {planType === 'credits' && (
            <div className="space-y-1.5">
              <Label htmlFor="ep-creditsPerMonth">Créditos por mes</Label>
              <Input
                id="ep-creditsPerMonth"
                name="creditsPerMonth"
                type="number"
                min="1"
                step="1"
                defaultValue={plan.creditsPerMonth ?? ''}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ep-description">Descripción (opcional)</Label>
            <Input id="ep-description" name="description" defaultValue={plan.description ?? ''} />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ep-active"
              name="active"
              defaultChecked={plan.active}
              className="h-4 w-4"
            />
            <Label htmlFor="ep-active">Plan activo</Label>
          </div>

          {state?.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
