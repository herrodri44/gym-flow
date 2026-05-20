'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/client'
import { gyms, gymSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireGymAdmin } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/server'
import { bulkCreateMembers, type BulkMemberInput, type BulkCreateResult } from '@/lib/domain/members-bulk'

export async function updateGymInfoAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const name = (formData.get('name') as string)?.trim()
  const address = (formData.get('address') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const openingHours = (formData.get('openingHours') as string)?.trim() || null
  const timezone =
    (formData.get('timezone') as string)?.trim() || 'America/Argentina/Buenos_Aires'

  if (!name) return { error: 'El nombre del gimnasio es requerido' }

  try {
    await db
      .update(gyms)
      .set({ name, address, phone, email, openingHours, timezone })
      .where(eq(gyms.id, ctx.gymId))

    revalidatePath('/admin/settings')
    return { success: true }
  } catch {
    return { error: 'Error al guardar la información del gimnasio' }
  }
}

export async function changePasswordAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const currentPassword = formData.get('currentPassword') as string
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Todos los campos son requeridos' }
  }
  if (newPassword.length < 8) {
    return { error: 'La nueva contraseña debe tener al menos 8 caracteres' }
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Las contraseñas nuevas no coinciden' }
  }

  const supabase = await createClient()

  // Verify current password before allowing the change
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: ctx.user.email!,
    password: currentPassword,
  })
  if (signInError) {
    return { error: 'La contraseña actual es incorrecta' }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) {
    return { error: 'Error al actualizar la contraseña' }
  }

  return { success: true }
}

export async function bulkCreateMembersAction(
  rows: BulkMemberInput[],
): Promise<BulkCreateResult & { error?: string }> {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado', created: 0, skipped: 0, errors: [] }
  if (rows.length === 0) return { error: 'No hay filas para importar', created: 0, skipped: 0, errors: [] }
  if (rows.length > 500) return { error: 'Máximo 500 socios por importación', created: 0, skipped: 0, errors: [] }

  const result = await bulkCreateMembers(ctx.gymId, rows)
  revalidatePath('/admin/members')
  return result
}

export async function updateOperationalSettingsAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const allowOverLimit = formData.get('allowOverLimit') === 'on'
  const autoGeneratePayments = formData.get('autoGeneratePayments') === 'on'
  const lowCreditsThresholdRaw = parseInt(
    formData.get('lowCreditsThreshold') as string,
    10,
  )
  const lowCreditsThreshold =
    isNaN(lowCreditsThresholdRaw) || lowCreditsThresholdRaw < 0
      ? 2
      : lowCreditsThresholdRaw

  try {
    await db
      .update(gymSettings)
      .set({ allowOverLimit, autoGeneratePayments, lowCreditsThreshold, updatedAt: new Date() })
      .where(eq(gymSettings.gymId, ctx.gymId))

    revalidatePath('/admin/settings')
    return { success: true }
  } catch {
    return { error: 'Error al guardar la configuración operativa' }
  }
}
