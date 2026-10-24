import { db } from '@/lib/db/client'
import { members, visits } from '@/lib/db/schema'
import { and, eq, ilike, or, sql } from 'drizzle-orm'
import { getMemberStanding, type MemberStanding } from './standing'
import { addDays } from './period-math'

export type MemberSummary = {
  id: string
  fullName: string
  documentNumber: string
}

export type FichajeChannel = 'fichaje_admin' | 'fichaje_public'

// Outcome for one resolved member. Dates are gym-local 'YYYY-MM-DD'.
export type MemberFichajeResult =
  | { status: 'ok'; member: MemberSummary; creditsLeft: number | null; validUntil: string }
  | { status: 'over_limit_allowed'; member: MemberSummary; validUntil: string }
  | { status: 'over_limit_denied'; member: MemberSummary; validUntil: string }
  | { status: 'grace_allowed'; member: MemberSummary; expiredOn: string; graceDaysLeft: number }
  | { status: 'expired'; member: MemberSummary; expiredOn: string }
  | { status: 'not_started'; member: MemberSummary; startsOn: string }
  | { status: 'no_plan'; member: MemberSummary }
  | { status: 'already_today'; member: MemberSummary }

export type FichajeResult =
  | MemberFichajeResult
  | { status: 'multiple_matches'; members: MemberSummary[] }
  | { status: 'not_found' }

// What to insert if the check-in goes ahead. Kept off the result so period
// ids never reach the browser.
export type VisitToRecord = { periodId: string | null; overLimit: boolean }

export type FichajeDecision = {
  result: MemberFichajeResult
  visit: VisitToRecord | null
}

type StandingInput = Pick<
  MemberStanding,
  | 'status'
  | 'periodId'
  | 'planType'
  | 'startDate'
  | 'endDate'
  | 'creditsLeft'
  | 'allowOverLimit'
  | 'graceDaysLeft'
>

// Pure decision: no DB access. See PROJECT.md §5 for the rules.
export function decideFichaje(
  member: MemberSummary,
  standing: StandingInput,
  alreadyToday: boolean,
): FichajeDecision {
  if (alreadyToday) return { result: { status: 'already_today', member }, visit: null }

  switch (standing.status) {
    case 'no_plan':
      return { result: { status: 'no_plan', member }, visit: null }

    case 'not_started':
      return { result: { status: 'not_started', member, startsOn: standing.startDate! }, visit: null }

    case 'expired':
      return { result: { status: 'expired', member, expiredOn: standing.endDate! }, visit: null }

    case 'grace':
      // Grace visits have no period yet; the next payment attaches them (B5).
      return {
        result: {
          status: 'grace_allowed',
          member,
          expiredOn: standing.endDate!,
          graceDaysLeft: standing.graceDaysLeft ?? 0,
        },
        visit: { periodId: null, overLimit: false },
      }

    case 'active': {
      const validUntil = addDays(standing.endDate!, -1)
      const periodId = standing.periodId!

      if (standing.planType === 'unlimited') {
        return {
          result: { status: 'ok', member, creditsLeft: null, validUntil },
          visit: { periodId, overLimit: false },
        }
      }
      const creditsLeft = standing.creditsLeft ?? 0
      if (creditsLeft > 0) {
        return {
          result: { status: 'ok', member, creditsLeft, validUntil },
          visit: { periodId, overLimit: false },
        }
      }
      if (standing.allowOverLimit) {
        return {
          result: { status: 'over_limit_allowed', member, validUntil },
          visit: { periodId, overLimit: true },
        }
      }
      return { result: { status: 'over_limit_denied', member, validUntil }, visit: null }
    }
  }
}

// Validate a specific member. Read only.
export async function evaluateMemberFichaje(
  member: MemberSummary,
  gymId: string,
): Promise<FichajeDecision> {
  const standing = await getMemberStanding(member.id, gymId)
  if (!standing) return { result: { status: 'no_plan', member }, visit: null }

  const [existing] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.memberId, member.id), eq(visits.visitDate, standing.today)))
    .limit(1)

  return decideFichaje(member, standing, !!existing)
}

// Search and validate. Read only. Public channel: exact DNI only (no name
// search, to avoid exposing member data); admin: DNI or partial name.
export async function validateFichaje(
  query: string,
  gymId: string,
  channel: FichajeChannel,
): Promise<{ result: FichajeResult; visit: VisitToRecord | null }> {
  const trimmed = query.trim()
  if (!trimmed) return { result: { status: 'not_found' }, visit: null }

  const match =
    channel === 'fichaje_public'
      ? eq(members.documentNumber, trimmed)
      : or(eq(members.documentNumber, trimmed), ilike(members.fullName, `%${trimmed}%`))

  const found = await db
    .select({
      id: members.id,
      fullName: members.fullName,
      documentNumber: members.documentNumber,
    })
    .from(members)
    .where(and(eq(members.gymId, gymId), eq(members.active, true), match))
    .limit(channel === 'fichaje_public' ? 2 : 10)

  if (found.length === 0) return { result: { status: 'not_found' }, visit: null }
  if (found.length > 1) return { result: { status: 'multiple_matches', members: found }, visit: null }

  return evaluateMemberFichaje(found[0], gymId)
}

// Insert the visit. Call only with a `visit` from a fresh decision.
// Returns false when the member already checked in today: the
// UNIQUE(member_id, visit_date) constraint is the real guard against
// double taps, not the read in evaluateMemberFichaje.
export async function recordVisit(input: {
  memberId: string
  gymId: string
  channel: FichajeChannel | 'staff_manual'
  visit: VisitToRecord
  recordedBy?: string
}): Promise<boolean> {
  const { memberId, gymId, channel, visit, recordedBy } = input
  const rows = await db.execute<{ id: string }>(sql`
    INSERT INTO visits
      (gym_id, member_id, visited_at, visit_date, channel, over_limit, period_id, recorded_by)
    SELECT ${gymId}::uuid, ${memberId}::uuid, now(), (now() AT TIME ZONE g.timezone)::date,
           ${channel}::visit_channel, ${visit.overLimit}, ${visit.periodId}::uuid, ${recordedBy ?? null}::uuid
    FROM gyms g
    WHERE g.id = ${gymId}::uuid
    ON CONFLICT (member_id, visit_date) DO NOTHING
    RETURNING id
  `)
  return rows.length > 0
}
