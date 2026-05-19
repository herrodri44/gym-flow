import { db } from '@/lib/db/client'
import { profiles, gyms, gymAdmins } from '@/lib/db/schema'
import type { Gym } from '@/lib/db/schema'
import { count, eq } from 'drizzle-orm'

export type AdminRow = {
  id: string
  fullName: string
  email: string
  createdAt: Date
  gymName: string | null
}

export type AdminsPageData = {
  allGyms: Gym[]
  admins: AdminRow[]
}

export async function getAdminsPageData(): Promise<AdminsPageData> {
  const [allGyms, admins] = await Promise.all([
    db.select().from(gyms).orderBy(gyms.name),
    db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
        createdAt: profiles.createdAt,
        gymName: gyms.name,
      })
      .from(profiles)
      .leftJoin(gymAdmins, eq(gymAdmins.userId, profiles.id))
      .leftJoin(gyms, eq(gyms.id, gymAdmins.gymId))
      .where(eq(profiles.role, 'gym_admin'))
      .orderBy(profiles.createdAt),
  ])

  return { allGyms, admins }
}

export type GymRow = {
  id: string
  name: string
  slug: string
  timezone: string
  createdAt: Date
  adminCount: number
}

export async function getGymsPageData(): Promise<GymRow[]> {
  const rows = await db
    .select({
      id: gyms.id,
      name: gyms.name,
      slug: gyms.slug,
      timezone: gyms.timezone,
      createdAt: gyms.createdAt,
      adminCount: count(gymAdmins.id),
    })
    .from(gyms)
    .leftJoin(gymAdmins, eq(gymAdmins.gymId, gyms.id))
    .groupBy(gyms.id)
    .orderBy(gyms.createdAt)

  return rows.map((r) => ({ ...r, adminCount: Number(r.adminCount) }))
}
