'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/client'
import { membershipPlans } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireGymAdmin } from '@/lib/auth/context'
import { pesosTocentavos } from '@/lib/utils'
import { enrollMember } from '@/lib/domain/enrollment'

export async function createPlanAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const name = (formData.get('name') as string)?.trim()
  const planType = formData.get('planType') as 'credits' | 'unlimited'
  const priceInput = parseFloat(formData.get('priceArs') as string)
  const creditsInput = formData.get('creditsPerMonth') as string
  const description = (formData.get('description') as string)?.trim() || null

  if (!name) return { error: 'El nombre es requerido' }
  if (planType !== 'credits' && planType !== 'unlimited') return { error: 'Tipo de plan inválido' }
  if (isNaN(priceInput) || priceInput < 0) return { error: 'El precio es inválido' }

  const creditsPerMonth =
    planType === 'credits'
      ? parseInt(creditsInput, 10)
      : null

  if (planType === 'credits' && (isNaN(creditsPerMonth!) || creditsPerMonth! <= 0)) {
    return { error: 'Los créditos por mes deben ser un número positivo' }
  }

  await db.insert(membershipPlans).values({
    gymId: ctx.gymId,
    name,
    planType,
    priceArs: pesosTocentavos(priceInput),
    creditsPerMonth,
    description,
  })

  revalidatePath('/admin/plans')
  return { success: true }
}

export async function updatePlanAction(planId: string, formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const [existing] = await db
    .select({ id: membershipPlans.id })
    .from(membershipPlans)
    .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.gymId, ctx.gymId)))
    .limit(1)

  if (!existing) return { error: 'Plan no encontrado' }

  const name = (formData.get('name') as string)?.trim()
  const planType = formData.get('planType') as 'credits' | 'unlimited'
  const priceInput = parseFloat(formData.get('priceArs') as string)
  const creditsInput = formData.get('creditsPerMonth') as string
  const description = (formData.get('description') as string)?.trim() || null
  const active = formData.get('active') === 'on'

  if (!name) return { error: 'El nombre es requerido' }
  if (planType !== 'credits' && planType !== 'unlimited') return { error: 'Tipo de plan inválido' }
  if (isNaN(priceInput) || priceInput < 0) return { error: 'El precio es inválido' }

  const creditsPerMonth =
    planType === 'credits'
      ? parseInt(creditsInput, 10)
      : null

  if (planType === 'credits' && (isNaN(creditsPerMonth!) || creditsPerMonth! <= 0)) {
    return { error: 'Los créditos por mes deben ser un número positivo' }
  }

  await db
    .update(membershipPlans)
    .set({ name, planType, priceArs: pesosTocentavos(priceInput), creditsPerMonth, description, active })
    .where(eq(membershipPlans.id, planId))

  revalidatePath('/admin/plans')
  return { success: true }
}

export async function archivePlanAction(planId: string) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const [existing] = await db
    .select({ id: membershipPlans.id })
    .from(membershipPlans)
    .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.gymId, ctx.gymId)))
    .limit(1)

  if (!existing) return { error: 'Plan no encontrado' }

  await db
    .update(membershipPlans)
    .set({ active: false })
    .where(eq(membershipPlans.id, planId))

  revalidatePath('/admin/plans')
  return { success: true }
}

// ─── Enrollments ──────────────────────────────────────────────────────────────

export async function enrollMemberAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const memberId = (formData.get('memberId') as string)?.trim()
  const planId = (formData.get('planId') as string)?.trim()
  const startedAt = (formData.get('startedAt') as string)?.trim()

  if (!memberId || !planId) return { error: 'Faltan datos requeridos' }

  const result = await enrollMember({
    gymId: ctx.gymId,
    memberId,
    planId,
    startedAt: startedAt ? new Date(startedAt) : undefined,
  })

  if ('error' in result) return result

  revalidatePath(`/admin/members/${memberId}`)
  revalidatePath('/admin/members')
  return { success: true }
}
