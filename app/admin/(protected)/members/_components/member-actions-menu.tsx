'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMemberAction } from '../actions'
import { EditMemberDialog, type MemberForEdit } from './edit-member-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Props = {
  member: MemberForEdit
}

export function MemberActionsMenu({ member }: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar a ${member.fullName}? Esta acción lo marcará como inactivo.`)) return
    setDeleting(true)
    await deleteMemberAction(member.id)
    setDeleting(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={deleting}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm text-zinc-500 hover:bg-zinc-100 focus:outline-none disabled:opacity-50"
        >
          <span className="sr-only">Acciones</span>
          <span aria-hidden>•••</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/admin/members/${member.id}`)}>
            Ver detalle
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-red-600 focus:text-red-600"
          >
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditMemberDialog member={member} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
