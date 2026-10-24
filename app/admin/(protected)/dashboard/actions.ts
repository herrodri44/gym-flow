'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireGymAdmin } from '@/lib/auth/context'
import { deactivateMembers } from '@/lib/domain/dashboard'

const memberIdsSchema = z.array(z.uuid()).min(1).max(1000)

export async function deactivateMembersAction(memberIds: string[]) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const parsed = memberIdsSchema.safeParse(memberIds)
  if (!parsed.success) return { error: 'Selección inválida.' }

  const count = await deactivateMembers(ctx.gymId, parsed.data)
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/members')
  return { success: true as const, count }
}
