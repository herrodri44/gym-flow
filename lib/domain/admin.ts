import { db } from '@/lib/db/client'
import { gyms, gymAdmins, profiles } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export type AdminLayoutData = {
  gymName: string
  hasMultipleGyms: boolean
  termsAcceptedAt: Date | null
}

export type AssignedGym = {
  id: string
  name: string
  timezone: string
}

export async function getAdminLayoutData(
  userId: string,
  activeGymId: string,
): Promise<AdminLayoutData | null> {
  const [[activeGym], allAssigned, [profile]] = await Promise.all([
    // Verify user is admin of the active gym specifically (not just any gym).
    // Without the activeGymId filter, multi-gym admins could see a wrong gym
    // name in the navbar when switching gyms.
    db
      .select({ name: gyms.name })
      .from(gyms)
      .innerJoin(gymAdmins, eq(gymAdmins.gymId, gyms.id))
      .where(and(eq(gyms.id, activeGymId), eq(gymAdmins.userId, userId)))
      .limit(1),
    db
      .select({ id: gymAdmins.id })
      .from(gymAdmins)
      .where(eq(gymAdmins.userId, userId)),
    db
      .select({ termsAcceptedAt: profiles.termsAcceptedAt })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1),
  ])

  if (!activeGym) return null

  return {
    gymName: activeGym.name,
    hasMultipleGyms: allAssigned.length > 1,
    termsAcceptedAt: profile?.termsAcceptedAt ?? null,
  }
}

export async function getAssignedGyms(userId: string): Promise<AssignedGym[]> {
  return db
    .select({ id: gyms.id, name: gyms.name, timezone: gyms.timezone })
    .from(gyms)
    .innerJoin(gymAdmins, eq(gymAdmins.gymId, gyms.id))
    .where(eq(gymAdmins.userId, userId))
    .orderBy(gyms.name)
}
