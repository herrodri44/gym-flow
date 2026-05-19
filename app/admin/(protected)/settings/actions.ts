'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/client'
import { gyms, gymSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireGymAdmin } from '@/lib/auth/context'

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

export async function updateOperationalSettingsAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const allowOverLimit = formData.get('allowOverLimit') === 'on'
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
      .set({ allowOverLimit, lowCreditsThreshold, updatedAt: new Date() })
      .where(eq(gymSettings.gymId, ctx.gymId))

    revalidatePath('/admin/settings')
    return { success: true }
  } catch {
    return { error: 'Error al guardar la configuración operativa' }
  }
}
