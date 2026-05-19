'use client'

import { useTransition } from 'react'
import { markOverdueAction } from '../actions'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function MarkOverdueButton({ count }: { count: number }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(`¿Marcar ${count} ${count === 1 ? 'pago pendiente' : 'pagos pendientes'} como vencidos?`)) return
    startTransition(() => { void markOverdueAction() })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={cn(buttonVariants({ variant: 'outline' }), 'text-red-600 border-red-200 hover:bg-red-50')}
    >
      {isPending ? 'Actualizando...' : `Marcar vencidos (${count})`}
    </button>
  )
}
