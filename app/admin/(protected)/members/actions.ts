'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/client'
import { members, creditAdjustments, profiles } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireGymAdmin } from '@/lib/auth/context'

export async function createMemberAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const fullName = (formData.get('fullName') as string)?.trim()
  const documentNumber = (formData.get('documentNumber') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const birthDate = (formData.get('birthDate') as string)?.trim() || null
  const joinedAt = (formData.get('joinedAt') as string)?.trim() || null

  if (!fullName) return { error: 'El nombre es requerido' }
  if (!documentNumber) return { error: 'El número de documento es requerido' }

  try {
    let userId: string | null = null

    if (email) {
      const adminSupabase = createAdminClient()
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email,
        password: documentNumber,
        email_confirm: true,
        app_metadata: { role: 'member' },
        user_metadata: { full_name: fullName },
      })

      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
          return { error: 'Ya existe un usuario con ese email' }
        }
        // Non-critical: continue without user account if auth creation fails
      } else if (authData.user) {
        userId = authData.user.id
        await db.insert(profiles).values({
          id: userId,
          role: 'member',
          fullName,
          email,
        })
      }
    }

    await db.insert(members).values({
      gymId: ctx.gymId,
      fullName,
      documentNumber,
      phone,
      email,
      birthDate,
      joinedAt,
      userId,
    })
    revalidatePath('/admin/members')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('unique')) return { error: 'Ya existe un socio con ese número de documento' }
    return { error: 'Error al crear el socio' }
  }
}

export async function updateMemberAction(memberId: string, formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const [existing] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.gymId, ctx.gymId)))
    .limit(1)

  if (!existing) return { error: 'Socio no encontrado' }

  const fullName = (formData.get('fullName') as string)?.trim()
  const documentNumber = (formData.get('documentNumber') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const birthDate = (formData.get('birthDate') as string)?.trim() || null
  const joinedAt = (formData.get('joinedAt') as string)?.trim() || null
  const active = formData.get('active') === 'on'

  if (!fullName) return { error: 'El nombre es requerido' }
  if (!documentNumber) return { error: 'El número de documento es requerido' }

  try {
    await db
      .update(members)
      .set({ fullName, documentNumber, phone, email, birthDate, joinedAt, active })
      .where(eq(members.id, memberId))
    revalidatePath('/admin/members')
    revalidatePath(`/admin/members/${memberId}`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('unique')) return { error: 'Ya existe un socio con ese número de documento' }
    return { error: 'Error al actualizar el socio' }
  }
}

export async function deleteMemberAction(memberId: string) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const [existing] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.gymId, ctx.gymId)))
    .limit(1)

  if (!existing) return { error: 'Socio no encontrado' }

  await db
    .update(members)
    .set({ active: false })
    .where(eq(members.id, memberId))

  revalidatePath('/admin/members')
  return { success: true }
}

export async function createCreditAdjustmentAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const memberId = (formData.get('memberId') as string)?.trim()
  const amount = parseInt(formData.get('amount') as string, 10)
  const date = (formData.get('date') as string)?.trim()
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!memberId) return { error: 'Socio no especificado' }
  if (isNaN(amount) || amount === 0) return { error: 'El monto debe ser un número distinto de cero' }
  if (!date) return { error: 'La fecha es requerida' }

  const [existing] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.gymId, ctx.gymId)))
    .limit(1)

  if (!existing) return { error: 'Socio no encontrado' }

  await db.insert(creditAdjustments).values({
    gymId: ctx.gymId,
    memberId,
    amount,
    date,
    recordedBy: ctx.user.id,
    notes,
  })

  revalidatePath(`/admin/members/${memberId}`)
  return { success: true }
}
