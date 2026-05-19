'use client'

import { useActionState, useState } from 'react'
import { createMemberAction } from '../actions'
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

type ActionState = { error?: string; success?: boolean } | undefined

export function CreateMemberDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_, fd) => {
      const result = await createMemberAction(fd)
      if (result?.success) setOpen(false)
      return result
    },
    undefined
  )

  const today = new Date().toISOString().split('T')[0]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants())}>
        Agregar socio
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo socio</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-fullName">Nombre completo</Label>
            <Input id="c-fullName" name="fullName" placeholder="Juan Pérez" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-documentNumber">Número de documento</Label>
            <Input id="c-documentNumber" name="documentNumber" placeholder="12345678" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Teléfono</Label>
              <Input id="c-phone" name="phone" placeholder="+54 11 1234-5678" type="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" name="email" placeholder="juan@ejemplo.com" type="email" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-birthDate">Fecha de nacimiento</Label>
              <Input id="c-birthDate" name="birthDate" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-joinedAt">Fecha de alta</Label>
              <Input id="c-joinedAt" name="joinedAt" type="date" defaultValue={today} />
            </div>
          </div>

          {state?.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Agregar socio'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
