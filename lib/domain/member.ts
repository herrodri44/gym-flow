/**
 * CONVENTION: Domain data functions
 *
 * Pages are renderers, not data orchestrators. Any page that needs more than
 * a single straightforward query should delegate to a domain function here.
 *
 * Structure your queries for minimum round trips:
 *
 *   1. Fetch the "anchor" row (the entity the page centers on).
 *      If you need a related field to parameterize subsequent queries —
 *      e.g. gymTimezone to build a month-boundary SQL fragment — JOIN it
 *      here so you have it before the next step.
 *
 *   2. Once you have the anchor + its required dependencies, fire everything
 *      else in a single Promise.all(). Queries that don't depend on each other
 *      should never be sequential.
 *
 * This keeps server component data loading at 2-3 DB round trips regardless
 * of how many queries are involved, instead of N sequential awaits.
 *
 * Return plain typed objects, not Drizzle result rows. Pages should receive
 * exactly the shape they need to render — no extra columns, no raw DB types
 * leaking through to JSX.
 */

import { db } from '@/lib/db/client'
import { gyms, members, visits } from '@/lib/db/schema'
import { and, eq, max, sql } from 'drizzle-orm'
import { getMemberStanding, type MemberStanding } from './standing'

export type MemberPortalData = {
  member: {
    id: string
    fullName: string
    documentNumber: string
    email: string | null
    phone: string | null
    birthDate: string | null
    joinedAt: string | null
    gymId: string
  }
  gym: {
    name: string
    timezone: string
  }
  standing: MemberStanding | null
  lastVisit: Date | null
  recentPeriods: Array<{
    id: string
    planName: string
    startDate: string
    endDate: string
    amountArs: number
    paidOn: string
  }>
}

/**
 * Returns null if no active member profile is linked to this Supabase user.
 * Auth (user existence) must be verified by the caller before invoking this.
 */
export async function getMemberPortalData(userId: string): Promise<MemberPortalData | null> {
  // Round trip 1: member + gym in one JOIN.
  const [row] = await db
    .select({
      memberId: members.id,
      fullName: members.fullName,
      documentNumber: members.documentNumber,
      email: members.email,
      phone: members.phone,
      birthDate: members.birthDate,
      joinedAt: members.joinedAt,
      gymId: members.gymId,
      gymName: gyms.name,
      gymTimezone: gyms.timezone,
    })
    .from(members)
    .innerJoin(gyms, eq(gyms.id, members.gymId))
    .where(and(eq(members.userId, userId), eq(members.active, true)))
    .limit(1)

  if (!row) return null

  const { memberId, gymId, gymTimezone } = row

  // Round trip 2: standing, last visit and recent periods in parallel.
  const [standing, [lastVisitRow], periods] = await Promise.all([
    getMemberStanding(memberId, gymId),

    db
      .select({ lastVisit: max(visits.visitedAt) })
      .from(visits)
      .where(and(eq(visits.memberId, memberId), eq(visits.gymId, gymId))),

    db.execute<{
      id: string
      plan_name: string
      start_date: string
      end_date: string
      amount_ars: number
      paid_on: string
    }>(sql`
      SELECT p.id, mp.name AS plan_name, p.start_date::text, p.end_date::text,
             pr.amount_ars, (pr.paid_at AT TIME ZONE ${gymTimezone})::date::text AS paid_on
      FROM membership_periods p
      JOIN membership_plans mp ON mp.id = p.plan_id
      JOIN payment_records pr ON pr.id = p.payment_id
      WHERE p.member_id = ${memberId}::uuid AND p.gym_id = ${gymId}::uuid
      ORDER BY p.start_date DESC
      LIMIT 6
    `),
  ])

  return {
    member: {
      id: memberId,
      fullName: row.fullName,
      documentNumber: row.documentNumber,
      email: row.email,
      phone: row.phone,
      birthDate: row.birthDate,
      joinedAt: row.joinedAt,
      gymId,
    },
    gym: {
      name: row.gymName,
      timezone: gymTimezone,
    },
    standing,
    lastVisit: lastVisitRow?.lastVisit ?? null,
    recentPeriods: periods.map((p) => ({
      id: p.id,
      planName: p.plan_name,
      startDate: p.start_date,
      endDate: p.end_date,
      amountArs: Number(p.amount_ars),
      paidOn: p.paid_on,
    })),
  }
}
