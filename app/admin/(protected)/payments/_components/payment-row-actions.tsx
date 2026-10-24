'use client'

import { useTransition } from 'react'
import { deletePaymentAction } from '../actions'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function PaymentRowActions({ paymentId, memberId }: { paymentId: string; memberId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('¿Eliminar este pago? También se elimina el período que habilitaba.')) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('paymentId', paymentId)
      fd.set('memberId', memberId)
      const result = await deletePaymentAction(fd)
      if ('error' in result) alert(result.error)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8')}
      >
        <span className="sr-only">Acciones</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="text-red-600" onClick={handleDelete}>
          Eliminar pago
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
