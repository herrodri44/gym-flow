import { db } from '@/lib/db/client'
import {
  members,
  enrollments,
  membershipPlans,
  visits,
  gymSettings,
} from '@/lib/db/schema'
import { and, eq, ilike, or, gte } from 'drizzle-orm'
import { dayStart } from '@/lib/db/time'
import { getAvailableCredits } from './credits'

export type MemberSummary = {
  id: string
  fullName: string
  documentNumber: string
}

export type FichajeResult =
  | { status: 'ok'; member: MemberSummary; creditsLeft: number | null }
  | { status: 'multiple_matches'; members: MemberSummary[] }
  | { status: 'already_today'; member: MemberSummary }
  | { status: 'over_limit_denied'; member: MemberSummary }
  | { status: 'over_limit_allowed'; member: MemberSummary }
  | { status: 'no_active_enrollment'; member: MemberSummary }
  | { status: 'not_found' }

// Search members and validate. Returns 'multiple_matches' if ambiguous (admin only).
// Does NOT create a Visit row.
export async function validateFichaje(
  query: string,
  gymId: string,
  gymTimezone: string,
  channel: 'fichaje_admin' | 'fichaje_public',
): Promise<FichajeResult> {
  const trimmed = query.trim()
  if (!trimmed) return { status: 'not_found' }

  let found: MemberSummary[]

  if (channel === 'fichaje_public') {
    // Public: exact document number only (no name search to avoid data exposure)
    found = await db
      .select({
        id: members.id,
        fullName: members.fullName,
        documentNumber: members.documentNumber,
      })
      .from(members)
      .where(
        and(
          eq(members.gymId, gymId),
          eq(members.active, true),
          eq(members.documentNumber, trimmed),
        ),
      )
      .limit(2)
  } else {
    // Admin: exact document number OR partial name (case-insensitive)
    found = await db
      .select({
        id: members.id,
        fullName: members.fullName,
        documentNumber: members.documentNumber,
      })
      .from(members)
      .where(
        and(
          eq(members.gymId, gymId),
          eq(members.active, true),
          or(
            eq(members.documentNumber, trimmed),
            ilike(members.fullName, `%${trimmed}%`),
          ),
        ),
      )
      .limit(10)
  }

  if (found.length === 0) return { status: 'not_found' }
  if (found.length > 1) return { status: 'multiple_matches', members: found }

  return validateMemberFichaje(found[0], gymId, gymTimezone)
}

// Validate a specific member. Does NOT create a Visit row.
export async function validateMemberFichaje(
  member: MemberSummary,
  gymId: string,
  gymTimezone: string,
): Promise<Exclude<FichajeResult, { status: 'multiple_matches' } | { status: 'not_found' }>> {
  // Rule: at most one visit per member per gym per calendar day (gym timezone)
  const todayStart = dayStart(gymTimezone)

  const [existing] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(
      and(
        eq(visits.memberId, member.id),
        eq(visits.gymId, gymId),
        gte(visits.visitedAt, todayStart),
      ),
    )
    .limit(1)

  if (existing) return { status: 'already_today', member }

  const creditsLeft = await getAvailableCredits(member.id, gymId, gymTimezone)

  if (creditsLeft === null) return { status: 'no_active_enrollment', member }
  if (creditsLeft === Infinity) return { status: 'ok', member, creditsLeft: null }
  if (creditsLeft > 0) return { status: 'ok', member, creditsLeft }

  const [settings] = await db
    .select({ allowOverLimit: gymSettings.allowOverLimit })
    .from(gymSettings)
    .where(eq(gymSettings.gymId, gymId))
    .limit(1)

  if (settings?.allowOverLimit) return { status: 'over_limit_allowed', member }
  return { status: 'over_limit_denied', member }
}

// Create a Visit row. Call only after validateFichaje returns 'ok' or 'over_limit_allowed'.
export async function recordVisit(
  memberId: string,
  gymId: string,
  channel: 'fichaje_admin' | 'fichaje_public' | 'staff_manual',
  overLimit: boolean,
  recordedBy?: string,
): Promise<void> {
  await db.insert(visits).values({
    gymId,
    memberId,
    visitedAt: new Date(),
    channel,
    overLimit,
    recordedBy: recordedBy ?? null,
  })
}
