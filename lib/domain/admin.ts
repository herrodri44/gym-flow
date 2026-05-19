import { db } from '@/lib/db/client'
import { gyms, gymAdmins } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export type AdminLayoutData = {
  gymName: string
  hasMultipleGyms: boolean
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
  const [[activeGym], allAssigned] = await Promise.all([
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
  ])

  if (!activeGym) return null

  return {
    gymName: activeGym.name,
    hasMultipleGyms: allAssigned.length > 1,
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
