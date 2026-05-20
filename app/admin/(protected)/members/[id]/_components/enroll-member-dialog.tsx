'use client'

import { useActionState, useState } from 'react'
import { enrollMemberAction } from '../../../plans/actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn, formatARS } from '@/lib/utils'
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

interface Plan {
  id: string
  name: string
  planType: 'credits' | 'unlimited'
  priceArs: number
  creditsPerMonth: number | null
}

interface EnrollMemberDialogProps {
  memberId: string
  plans: Plan[]
  hasActiveEnrollment: boolean
}

type ActionState = { error: string } | { success: boolean } | undefined

export function EnrollMemberDialog({ memberId, plans, hasActiveEnrollment }: EnrollMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_, fd) => {
      fd.set('memberId', memberId)
      fd.set('planId', selectedPlanId)
      const result = await enrollMemberAction(fd)
      if (result && 'success' in result) {
        setOpen(false)
        setSelectedPlanId('')
      }
      return result
    },
    undefined
  )

  const today = new Date().toISOString().split('T')[0]
  const selectedPlan = plans.find((p) => p.id === selectedPlanId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: hasActiveEnrollment ? 'outline' : 'default', size: 'sm' }))}>
        {hasActiveEnrollment ? 'Cambiar plan' : 'Inscribir en plan'}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hasActiveEnrollment ? 'Cambiar plan' : 'Inscribir en plan'}</DialogTitle>
        </DialogHeader>

        {hasActiveEnrollment && (
          <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
            El socio tiene una inscripción activa. Al confirmar, se reemplazará por el nuevo plan.
          </p>
        )}

        {plans.length === 0 ? (
          <p className="text-sm text-zinc-500">No hay planes activos en este gimnasio. Creá uno primero desde la sección Planes.</p>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={selectedPlanId} onValueChange={(v) => setSelectedPlanId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un plan…" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} — {formatARS(plan.priceArs)} / mes
                      {plan.planType === 'credits' ? ` · ${plan.creditsPerMonth} créditos` : ' · Libre'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPlan && (
              <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm space-y-1">
                <p><span className="text-zinc-500">Tipo:</span> {selectedPlan.planType === 'unlimited' ? 'Libre (ilimitado)' : 'Por créditos'}</p>
                <p><span className="text-zinc-500">Precio:</span> {formatARS(selectedPlan.priceArs)} / mes</p>
                {selectedPlan.planType === 'credits' && (
                  <p><span className="text-zinc-500">Créditos/mes:</span> {selectedPlan.creditsPerMonth}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="em-startedAt">Fecha de inicio</Label>
              <Input id="em-startedAt" name="startedAt" type="date" defaultValue={today} />
            </div>

            {state && 'error' in state && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || !selectedPlanId}>
                {pending ? 'Guardando…' : 'Confirmar inscripción'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
