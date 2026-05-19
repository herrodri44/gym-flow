'use client'

import { useActionState, useState } from 'react'
import { createAdminAction } from '../actions'
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
import type { Gym } from '@/lib/db/schema'

type ActionState = { error: string } | { success: true } | undefined

export function CreateAdminDialog({ gyms }: { gyms: Gym[] }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_, fd) => {
      const result = await createAdminAction(fd)
      if (result && 'success' in result) setOpen(false)
      return result
    },
    undefined
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants())}>
        Crear administrador
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo administrador de gimnasio</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-name">Nombre completo</Label>
            <Input id="admin-name" name="fullName" placeholder="Juan García" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              name="email"
              type="email"
              placeholder="juan@ejemplo.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Contraseña inicial</Label>
            <Input
              id="admin-password"
              name="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-gym">Gimnasio asignado</Label>
            <Select name="gymId" required>
              <SelectTrigger id="admin-gym">
                <SelectValue placeholder="Elegí un gimnasio" />
              </SelectTrigger>
              <SelectContent>
                {gyms.map((gym) => (
                  <SelectItem key={gym.id} value={gym.id}>
                    {gym.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {state && 'error' in state && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creando…' : 'Crear administrador'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
