'use client'

import { useTransition } from 'react'
import { updatePaymentStatusAction, deletePaymentAction } from '../actions'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Props {
  payment: {
    id: string
    status: 'paid' | 'pending' | 'overdue'
  }
}

export function PaymentRowActions({ payment }: Props) {
  const [isPending, startTransition] = useTransition()

  function changeStatus(newStatus: 'paid' | 'pending' | 'overdue') {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('paymentId', payment.id)
      fd.set('status', newStatus)
      await updatePaymentStatusAction(fd)
    })
  }

  function handleDelete() {
    if (!confirm('¿Eliminar este registro de pago?')) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('paymentId', payment.id)
      await deletePaymentAction(fd)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          'h-8 w-8'
        )}
      >
        <span className="sr-only">Acciones</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {payment.status !== 'paid' && (
          <DropdownMenuItem onClick={() => changeStatus('paid')}>
            Marcar como pagado
          </DropdownMenuItem>
        )}
        {payment.status !== 'pending' && (
          <DropdownMenuItem onClick={() => changeStatus('pending')}>
            Marcar como pendiente
          </DropdownMenuItem>
        )}
        {payment.status !== 'overdue' && (
          <DropdownMenuItem onClick={() => changeStatus('overdue')}>
            Marcar como vencido
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600"
          onClick={handleDelete}
        >
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
