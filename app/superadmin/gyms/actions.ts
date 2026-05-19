'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/client'
import { gyms, gymSettings } from '@/lib/db/schema'
import { requireSuperAdmin } from '@/lib/auth/context'

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export async function createGymAction(formData: FormData) {
  if (!await requireSuperAdmin()) return { error: 'No autorizado' }

  const name = (formData.get('name') as string).trim()
  const timezone = (formData.get('timezone') as string) || 'America/Argentina/Buenos_Aires'

  if (!name) return { error: 'El nombre es requerido' }

  const slug = slugify(name)

  try {
    const [gym] = await db
      .insert(gyms)
      .values({ name, slug, timezone })
      .returning()

    await db.insert(gymSettings).values({ gymId: gym.id })

    revalidatePath('/superadmin/gyms')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('unique')) return { error: 'Ya existe un gimnasio con ese nombre' }
    return { error: 'Error al crear el gimnasio' }
  }
}
