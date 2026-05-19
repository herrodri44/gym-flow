import { db } from '@/lib/db/client'
import { profiles, gymAdmins } from '@/lib/db/schema'
import { createAdminClient } from '@/lib/supabase/admin'

export type CreateGymAdminInput = {
  email: string
  password: string
  fullName: string
  gymId: string
}

export async function createGymAdmin(
  input: CreateGymAdminInput,
): Promise<{ error: string } | { success: true }> {
  const { email, password, fullName, gymId } = input
  const adminClient = createAdminClient()

  // Step 1: create the Supabase Auth user. Nothing in the DB exists yet,
  // so a failure here requires no compensation.
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

  const userId = authData.user.id

  // Step 2: insert profile + gym assignment atomically. If either insert
  // fails, the transaction rolls back both rows and we delete the auth user
  // so no orphan is left behind.
  try {
    await db.transaction(async (tx) => {
      await tx.insert(profiles).values({ id: userId, role: 'gym_admin', fullName, email })
      await tx.insert(gymAdmins).values({ gymId, userId })
    })
  } catch (e: unknown) {
    await adminClient.auth.admin.deleteUser(userId)
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('unique')) return { error: 'Este administrador ya está asignado a ese gimnasio' }
    return { error: 'Error al crear el administrador' }
  }

  return { success: true }
}
