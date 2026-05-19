'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/auth/context'
import { createGymAdmin } from '@/lib/domain/users'

export async function createAdminAction(formData: FormData) {
  if (!await requireSuperAdmin()) return { error: 'No autorizado' }

  const fullName = (formData.get('fullName') as string).trim()
  const email = (formData.get('email') as string).trim()
  const password = formData.get('password') as string
  const gymId = formData.get('gymId') as string

  if (!fullName || !email || !password || !gymId) {
    return { error: 'Todos los campos son requeridos' }
  }

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' }
  }

  const result = await createGymAdmin({ email, password, fullName, gymId })
  if ('success' in result) revalidatePath('/superadmin/admins')
  return result
}
