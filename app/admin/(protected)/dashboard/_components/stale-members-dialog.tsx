'use client'

import { useState, useTransition } from 'react'
import { deactivateMembersAction } from '../actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatDay } from '@/lib/standing-ui'
import { STALE_AFTER_DAYS } from '@/lib/domain/activity'
import type { StaleMember } from '@/lib/domain/dashboard'

export function StaleMembersDialog({ members }: { members: StaleMember[] }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map((m) => m.id)))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setSelected(new Set(members.map((m) => m.id)))
      setError(null)
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === members.length ? new Set() : new Set(members.map((m) => m.id))))
  }

  function confirm() {
    setError(null)
    startTransition(async () => {
      const result = await deactivateMembersAction([...selected])
      if (result.error) setError(result.error)
      else setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
        Revisar y dar de baja
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dar de baja socios sin actividad</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-500">
          No pagan ni vienen hace más de {STALE_AFTER_DAYS} días. Darlos de baja los saca de los
          listados y de los totales; podés reactivarlos desde su ficha si vuelven.
        </p>

        <div className="flex items-center justify-between border-b pb-2 text-xs text-zinc-500">
          <button type="button" onClick={toggleAll} className="font-medium hover:text-zinc-800">
            {selected.size === members.length ? 'Desmarcar todos' : 'Marcar todos'}
          </button>
          <span>
            {selected.size} de {members.length} seleccionados
          </span>
        </div>

        <ul className="max-h-80 space-y-0.5 overflow-y-auto pr-1">
          {members.map((m) => (
            <li key={m.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded px-1 py-1.5 hover:bg-zinc-50">
                <input
                  type="checkbox"
                  className="size-4 accent-zinc-900"
                  checked={selected.has(m.id)}
                  onChange={() => toggle(m.id)}
                />
                <span className="flex-1 truncate text-sm font-medium text-zinc-800">{m.fullName}</span>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                  {m.status === 'no_plan' ? 'sin plan · ' : ''}última act. {formatDay(m.lastActivity)}
                </span>
              </label>
            </li>
          ))}
        </ul>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={isPending || selected.size === 0}>
            {isPending ? 'Guardando…' : `Dar de baja (${selected.size})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
