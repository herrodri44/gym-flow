'use client'

import { useActionState, useState } from 'react'
import { changePasswordAction } from '../actions'
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

type ActionState = { error: string } | { success: boolean } | undefined

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_, fd) => {
      const result = await changePasswordAction(fd)
      if (result && 'success' in result) setOpen(false)
      return result
    },
    undefined,
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }))}>
        Cambiar contraseña
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-current">Contraseña actual</Label>
            <Input id="cp-current" name="currentPassword" type="password" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">Nueva contraseña</Label>
            <Input
              id="cp-new"
              name="newPassword"
              type="password"
              placeholder="Mínimo 8 caracteres"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Confirmar nueva contraseña</Label>
            <Input id="cp-confirm" name="confirmPassword" type="password" required />
          </div>

          {state && 'error' in state && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
