'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { db } from '@/lib/db/client'
import { membershipPlans, enrollments, members, gymAdmins } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { pesosTocentavos } from '@/lib/utils'

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'gym_admin') return null

  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)?.value
  if (!gymId) return null

  const [assignment] = await db
    .select({ id: gymAdmins.id })
    .from(gymAdmins)
    .where(and(eq(gymAdmins.gymId, gymId), eq(gymAdmins.userId, user.id)))
    .limit(1)

  if (!assignment) return null
  return { user, gymId }
}

export async function createPlanAction(formData: FormData) {
  const ctx = await getAuthContext()
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
  const ctx = await getAuthContext()
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
  const active = formData.get('active') === 'on' ? 'true' : 'false'

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
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'No autorizado' }

  const [existing] = await db
    .select({ id: membershipPlans.id })
    .from(membershipPlans)
    .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.gymId, ctx.gymId)))
    .limit(1)

  if (!existing) return { error: 'Plan no encontrado' }

  await db
    .update(membershipPlans)
    .set({ active: 'false' })
    .where(eq(membershipPlans.id, planId))

  revalidatePath('/admin/plans')
  return { success: true }
}

// ─── Enrollments ──────────────────────────────────────────────────────────────

export async function enrollMemberAction(formData: FormData) {
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'No autorizado' }

  const memberId = (formData.get('memberId') as string)?.trim()
  const planId = (formData.get('planId') as string)?.trim()
  const startedAt = (formData.get('startedAt') as string)?.trim()

  if (!memberId || !planId) return { error: 'Faltan datos requeridos' }

  // Verify member belongs to this gym
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.gymId, ctx.gymId)))
    .limit(1)

  if (!member) return { error: 'Socio no encontrado' }

  // Verify plan belongs to this gym
  const [plan] = await db
    .select({ id: membershipPlans.id })
    .from(membershipPlans)
    .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.gymId, ctx.gymId)))
    .limit(1)

  if (!plan) return { error: 'Plan no encontrado' }

  // Deactivate any existing active enrollment for this member in this gym
  await db
    .update(enrollments)
    .set({ active: 'false', endedAt: new Date() })
    .where(
      and(
        eq(enrollments.memberId, memberId),
        eq(enrollments.gymId, ctx.gymId),
        eq(enrollments.active, 'true')
      )
    )

  // Create new enrollment
  await db.insert(enrollments).values({
    gymId: ctx.gymId,
    memberId,
    planId,
    startedAt: startedAt ? new Date(startedAt) : new Date(),
    active: 'true',
  })

  revalidatePath(`/admin/members/${memberId}`)
  revalidatePath('/admin/members')
  return { success: true }
}
