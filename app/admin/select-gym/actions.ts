'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { db } from '@/lib/db/client'
import { gymAdmins } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'

export async function selectGymAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'gym_admin') redirect('/login')

  const gymId = formData.get('gymId') as string

  // Verificar que este gym esté asignado al admin
  const [assignment] = await db
    .select()
    .from(gymAdmins)
    .where(and(eq(gymAdmins.userId, user.id), eq(gymAdmins.gymId, gymId)))
    .limit(1)

  if (!assignment) redirect('/admin/select-gym')

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_GYM_COOKIE, gymId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 días
  })

  redirect('/admin/dashboard')
}
