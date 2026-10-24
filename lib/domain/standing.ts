import { db } from '@/lib/db/client'
import { memberStanding } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

// One row of the `member_standing` view (migration 0006): the member's
// reference period, status (active / grace / expired / no_plan / not_started)
// and credits. Every surface that asks "can this member train, and how many
// credits are left" reads it from here.
export type MemberStanding = typeof memberStanding.$inferSelect

export async function getMemberStanding(
  memberId: string,
  gymId: string,
): Promise<MemberStanding | null> {
  const [row] = await db
    .select()
    .from(memberStanding)
    .where(and(eq(memberStanding.memberId, memberId), eq(memberStanding.gymId, gymId)))
    .limit(1)
  return row ?? null
}

export async function getMemberStandings(
  memberIds: string[],
  gymId: string,
): Promise<Map<string, MemberStanding>> {
  if (memberIds.length === 0) return new Map()
  const rows = await db
    .select()
    .from(memberStanding)
    .where(and(inArray(memberStanding.memberId, memberIds), eq(memberStanding.gymId, gymId)))
  return new Map(rows.map((r) => [r.memberId, r]))
}
