'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/client'
import { profiles, gymAdmins } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createAdminAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'superadmin') {
    return { error: 'No autorizado' }
  }

  const fullName = (formData.get('fullName') as string).trim()
  const email = (formData.get('email') as string).trim()
  const password = (formData.get('password') as string)
  const gymId = (formData.get('gymId') as string)

  if (!fullName || !email || !password || !gymId) {
    return { error: 'Todos los campos son requeridos' }
  }

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' }
  }

  const adminClient = createAdminClient()

  try {
    // Crear usuario en Supabase Auth con rol en app_metadata
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'gym_admin' },
      user_metadata: { full_name: fullName },
    })

    if (authError || !authData.user) {
      if (authError?.message?.includes('already registered')) {
        return { error: 'Ya existe un usuario con ese email' }
      }
      return { error: 'Error al crear el usuario' }
    }

    // Crear perfil en nuestra tabla
    await db.insert(profiles).values({
      id: authData.user.id,
      role: 'gym_admin',
      fullName,
      email,
    })

    // Asignar al gimnasio
    await db.insert(gymAdmins).values({
      gymId,
      userId: authData.user.id,
    })

    revalidatePath('/superadmin/admins')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('unique')) return { error: 'Este administrador ya está asignado a ese gimnasio' }
    return { error: 'Error al crear el administrador' }
  }
}
