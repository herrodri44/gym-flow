'use client'

import { useActionState, useState } from 'react'
import { createPlanAction } from '../actions'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ActionState = { error?: string; success?: boolean } | undefined

export function CreatePlanDialog() {
  const [open, setOpen] = useState(false)
  const [planType, setPlanType] = useState<'credits' | 'unlimited'>('credits')
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_, fd) => {
      fd.set('planType', planType)
      const result = await createPlanAction(fd)
      if (result?.success) {
        setOpen(false)
        setPlanType('credits')
      }
      return result
    },
    undefined
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants())}>
        Crear plan
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo plan</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-name">Nombre del plan</Label>
            <Input id="cp-name" name="name" placeholder="Mensual estándar" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-planType">Tipo</Label>
            <Select value={planType} onValueChange={(v) => setPlanType((v ?? 'credits') as 'credits' | 'unlimited')}>
              <SelectTrigger id="cp-planType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credits">Por créditos</SelectItem>
                <SelectItem value="unlimited">Libre (ilimitado)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-priceArs">Precio ($ ARS)</Label>
            <Input
              id="cp-priceArs"
              name="priceArs"
              type="number"
              min="0"
              step="1"
              placeholder="30000"
              required
            />
            <p className="text-xs text-zinc-500">Ingresá el monto en pesos (ej: 30000 = $ 30.000)</p>
          </div>

          {planType === 'credits' && (
            <div className="space-y-1.5">
              <Label htmlFor="cp-creditsPerMonth">Créditos por mes</Label>
              <Input
                id="cp-creditsPerMonth"
                name="creditsPerMonth"
                type="number"
                min="1"
                step="1"
                placeholder="12"
                required
              />
              <p className="text-xs text-zinc-500">Cantidad de ingresos permitidos por mes</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cp-description">Descripción (opcional)</Label>
            <Input id="cp-description" name="description" placeholder="3 veces por semana…" />
          </div>

          {state?.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Crear plan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
