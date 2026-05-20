'use client'

import { useActionState, useState } from 'react'
import { updateMemberAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ActionState = { error?: string; success?: boolean } | undefined

export type MemberForEdit = {
  id: string
  fullName: string
  documentNumber: string
  phone: string | null
  email: string | null
  birthDate: string | null
  joinedAt: string | null
  active: boolean
}

type Props = {
  member: MemberForEdit
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditMemberDialog({ member, open, onOpenChange }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_, fd) => {
      const result = await updateMemberAction(member.id, fd)
      if (result?.success) onOpenChange(false)
      return result
    },
    undefined
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar socio</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="e-fullName">Nombre completo</Label>
            <Input
              id="e-fullName"
              name="fullName"
              defaultValue={member.fullName}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-documentNumber">Número de documento</Label>
            <Input
              id="e-documentNumber"
              name="documentNumber"
              defaultValue={member.documentNumber}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-phone">Teléfono</Label>
              <Input
                id="e-phone"
                name="phone"
                type="tel"
                defaultValue={member.phone ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-email">Email</Label>
              <Input
                id="e-email"
                name="email"
                type="email"
                defaultValue={member.email ?? ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-birthDate">Fecha de nacimiento</Label>
              <Input
                id="e-birthDate"
                name="birthDate"
                type="date"
                defaultValue={member.birthDate ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-joinedAt">Fecha de alta</Label>
              <Input
                id="e-joinedAt"
                name="joinedAt"
                type="date"
                defaultValue={member.joinedAt ?? ''}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="e-active"
              name="active"
              type="checkbox"
              defaultChecked={member.active}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <Label htmlFor="e-active">Socio activo</Label>
          </div>

          {state?.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
