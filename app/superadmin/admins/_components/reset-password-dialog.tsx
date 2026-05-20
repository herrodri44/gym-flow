'use client'

import { useActionState, useState } from 'react'
import { resetAdminPasswordAction } from '../actions'
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

export function ResetPasswordDialog({
  adminId,
  adminName,
}: {
  adminId: string
  adminName: string
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_, fd) => resetAdminPasswordAction(fd),
    undefined,
  )

  const succeeded = state && 'success' in state

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
        Restablecer contraseña
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
        </DialogHeader>

        {succeeded ? (
          <div className="space-y-4">
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Contraseña de <strong>{adminName}</strong> restablecida correctamente.
              Compartí la nueva contraseña por un canal seguro.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="adminId" value={adminId} />
            <p className="text-sm text-zinc-500">
              Estás restableciendo la contraseña de <strong>{adminName}</strong>.
              Compartí la nueva contraseña con el administrador por un canal seguro.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="rp-new">Nueva contraseña</Label>
              <Input
                id="rp-new"
                name="newPassword"
                type="password"
                placeholder="Mínimo 8 caracteres"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-confirm">Confirmar contraseña</Label>
              <Input id="rp-confirm" name="confirmPassword" type="password" required />
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
                {pending ? 'Guardando…' : 'Restablecer'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
