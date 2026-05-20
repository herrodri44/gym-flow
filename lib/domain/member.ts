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
import {
  gyms,
  members,
  enrollments,
  membershipPlans,
  visits,
  creditAdjustments,
  paymentRecords,
} from '@/lib/db/schema'
import { and, count, desc, eq, gte, lte, max, sql, sum } from 'drizzle-orm'
import { monthStart, monthStartDate } from '@/lib/db/time'

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
  enrollment: {
    planName: string
    planType: 'credits' | 'unlimited'
    creditsPerMonth: number | null
    priceArs: number
    startedAt: Date
  } | null
  lastVisit: Date | null
  /** null = unlimited plan; number = credits-based remaining credits this month */
  creditsLeft: number | null
  usedCredits: number
  hasPaid: boolean
  recentPayments: Array<{
    id: string
    amountArs: number
    status: 'paid' | 'pending' | 'overdue'
    periodStart: Date
    periodEnd: Date
    paidAt: Date | null
  }>
}

/**
 * Returns null if no active member profile is linked to this Supabase user.
 * Auth (user existence) must be verified by the caller before invoking this.
 */
export async function getMemberPortalData(userId: string): Promise<MemberPortalData | null> {
  // Round trip 1: member + gym in one JOIN.
  // We need gymTimezone to build the month-boundary SQL fragment used by
  // the visit and adjustment queries below. Fetching it here lets all
  // remaining queries run in parallel in round trip 2.
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

  const mStart = monthStart(gymTimezone)
  const mStartDate = monthStartDate(gymTimezone)

  // Round trip 2: six independent queries in parallel.
  const [
    enrollmentRows,
    [lastVisitRow],
    [{ visitCount }],
    [{ adjustmentSum }],
    hasPaidRows,
    payments,
  ] = await Promise.all([
    // Active plan details
    db
      .select({
        planName: membershipPlans.name,
        planType: membershipPlans.planType,
        creditsPerMonth: membershipPlans.creditsPerMonth,
        priceArs: membershipPlans.priceArs,
        startedAt: enrollments.startedAt,
      })
      .from(enrollments)
      .innerJoin(membershipPlans, eq(membershipPlans.id, enrollments.planId))
      .where(
        and(
          eq(enrollments.memberId, memberId),
          eq(enrollments.gymId, gymId),
          eq(enrollments.active, true)
        )
      )
      .limit(1),

    // Last visit timestamp (all time)
    db
      .select({ lastVisit: max(visits.visitedAt) })
      .from(visits)
      .where(and(eq(visits.memberId, memberId), eq(visits.gymId, gymId))),

    // Visits used this month (excludes over-limit visits)
    db
      .select({ visitCount: count() })
      .from(visits)
      .where(
        and(
          eq(visits.memberId, memberId),
          eq(visits.gymId, gymId),
          eq(visits.overLimit, false),
          gte(visits.visitedAt, mStart)
        )
      ),

    // Credit adjustments this month
    db
      .select({ adjustmentSum: sum(creditAdjustments.amount) })
      .from(creditAdjustments)
      .where(
        and(
          eq(creditAdjustments.memberId, memberId),
          eq(creditAdjustments.gymId, gymId),
          gte(creditAdjustments.date, mStartDate)
        )
      ),

    // Whether a paid record covers today
    db
      .select({ id: paymentRecords.id })
      .from(paymentRecords)
      .where(
        and(
          eq(paymentRecords.memberId, memberId),
          eq(paymentRecords.gymId, gymId),
          eq(paymentRecords.status, 'paid'),
          lte(paymentRecords.periodStart, sql`now()`),
          gte(paymentRecords.periodEnd, sql`now()`)
        )
      )
      .limit(1),

    // Recent payment history
    db
      .select({
        id: paymentRecords.id,
        amountArs: paymentRecords.amountArs,
        status: paymentRecords.status,
        periodStart: paymentRecords.periodStart,
        periodEnd: paymentRecords.periodEnd,
        paidAt: paymentRecords.paidAt,
      })
      .from(paymentRecords)
      .where(and(eq(paymentRecords.memberId, memberId), eq(paymentRecords.gymId, gymId)))
      .orderBy(desc(paymentRecords.periodStart))
      .limit(6),
  ])

  const enrollment = enrollmentRows[0] ?? null
  const usedCredits = Number(visitCount ?? 0)
  const adjustments = Number(adjustmentSum ?? 0)
  const isUnlimited = enrollment?.planType === 'unlimited'
  const creditsLeft = isUnlimited
    ? null
    : enrollment
      ? (enrollment.creditsPerMonth ?? 0) - usedCredits + adjustments
      : null

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
    enrollment: enrollment
      ? {
          planName: enrollment.planName,
          planType: enrollment.planType,
          creditsPerMonth: enrollment.creditsPerMonth,
          priceArs: enrollment.priceArs,
          startedAt: enrollment.startedAt,
        }
      : null,
    lastVisit: lastVisitRow?.lastVisit ?? null,
    creditsLeft,
    usedCredits,
    hasPaid: hasPaidRows.length > 0,
    recentPayments: payments.map((p) => ({
      id: p.id,
      amountArs: p.amountArs,
      status: p.status,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      paidAt: p.paidAt,
    })),
  }
}
