import { cookies } from 'next/headers'
import { db } from '@/lib/db/client'
import { gymAdmins } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { and, eq } from 'drizzle-orm'
import type { User } from '@supabase/supabase-js'

export type GymAdminContext = { user: User; gymId: string }
export type SuperAdminContext = { user: User }

// Returns { user, gymId } when the caller is a verified gym_admin with an
// active gym cookie that matches a real assignment row. Returns null on any
// auth or authorization failure — callers should treat null as "return { error } or null".
export async function requireGymAdmin(): Promise<GymAdminContext | null> {
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

// Returns { user } when the caller is a verified superadmin.
// Returns null on any auth or authorization failure.
export async function requireSuperAdmin(): Promise<SuperAdminContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'superadmin') return null
  return { user }
}
