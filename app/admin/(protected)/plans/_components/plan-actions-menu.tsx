'use client'

import { useState, useTransition } from 'react'
import { archivePlanAction } from '../actions'
import { EditPlanDialog } from './edit-plan-dialog'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Plan {
  id: string
  name: string
  planType: 'credits' | 'unlimited'
  priceArs: number
  creditsPerMonth: number | null
  description: string | null
  active: boolean
}

export function PlanActionsMenu({ plan }: { plan: Plan }) {
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleArchive() {
    if (!confirm(`¿Desactivar el plan "${plan.name}"? Los socios inscriptos conservan su inscripción activa.`)) return
    startTransition(async () => {
      await archivePlanAction(plan.id)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          disabled={isPending}
        >
          •••
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            Editar
          </DropdownMenuItem>
          {plan.active && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleArchive} className="text-red-600">
                Desactivar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPlanDialog plan={plan} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
