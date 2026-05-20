'use client'

import { useState, useTransition } from 'react'
import { generatePaymentsAction } from '../actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function formatMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

interface Props {
  autoGeneratePayments: boolean
  selectedMonth: string
}

export function GeneratePaymentsButton({ autoGeneratePayments, selectedMonth }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      await generatePaymentsAction(selectedMonth)
      setOpen(false)
    })
  }

  return (
    <>
      <div className="relative group">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          disabled={autoGeneratePayments}
        >
          Generar cuotas del mes
        </Button>
        {autoGeneratePayments && (
          <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            La generación automática está activa
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generar cuotas del mes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            Se crearán cuotas pendientes de{' '}
            <span className="font-semibold capitalize">{formatMonth(selectedMonth)}</span> para
            todos los socios activos con plan. Los socios que ya tienen una cuota registrada para ese
            mes no se verán afectados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={pending}>
              {pending ? 'Generando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
