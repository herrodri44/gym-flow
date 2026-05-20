'use client'

import { useActionState } from 'react'
import { updateMemberNotesAction } from '../../actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type ActionState = { error?: string; success?: boolean } | undefined

export function MemberNotesForm({ memberId, notes }: { memberId: string; notes: string | null }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    (_, fd) => updateMemberNotesAction(memberId, fd),
    undefined
  )

  return (
    <form action={formAction} className="space-y-3">
      <Textarea
        name="notes"
        defaultValue={notes ?? ''}
        placeholder="Objetivos, advertencias, contexto…"
        rows={4}
      />
      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state?.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Notas guardadas.</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar notas'}
        </Button>
      </div>
    </form>
  )
}
