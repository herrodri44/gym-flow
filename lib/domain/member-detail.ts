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
import { and, count, desc, eq, gte, sum } from 'drizzle-orm'
import { monthStart, monthStartDate } from '@/lib/db/time'

export type MemberDetailData = {
  member: {
    id: string
    fullName: string
    documentNumber: string
    email: string | null
    phone: string | null
    birthDate: string | null
    joinedAt: string | null
    active: boolean
    gymId: string
  }
  gymTimezone: string
  enrollment: {
    planId: string
    planName: string
    planType: 'credits' | 'unlimited'
    creditsPerMonth: number | null
    startedAt: Date
  } | null
  /** Active plans available for the enroll dialog */
  activePlans: Array<{
    id: string
    name: string
    planType: 'credits' | 'unlimited'
    priceArs: number
    creditsPerMonth: number | null
  }>
  /** null = unlimited plan */
  creditsLeft: number | null
  usedCreditsThisMonth: number
  recentVisits: Array<{
    id: string
    visitedAt: Date
    channel: string
    overLimit: boolean
  }>
  lastPayments: Array<{
    id: string
    amountArs: number
    status: 'paid' | 'pending' | 'overdue'
    periodStart: Date
    periodEnd: Date
    paidAt: Date | null
  }>
  recentAdjustments: Array<{
    id: string
    amount: number
    date: string
    notes: string | null
  }>
}

/**
 * Returns null if the member does not exist or does not belong to this gym.
 * The caller is responsible for calling notFound() in that case.
 */
export async function getMemberDetail(
  memberId: string,
  gymId: string
): Promise<MemberDetailData | null> {
  // Round trip 1: member + gym joined so gymTimezone is available
  // before the parallel batch in round trip 2.
  const [row] = await db
    .select({
      memberId: members.id,
      fullName: members.fullName,
      documentNumber: members.documentNumber,
      email: members.email,
      phone: members.phone,
      birthDate: members.birthDate,
      joinedAt: members.joinedAt,
      active: members.active,
      gymTimezone: gyms.timezone,
    })
    .from(members)
    .innerJoin(gyms, eq(gyms.id, members.gymId))
    .where(and(eq(members.id, memberId), eq(members.gymId, gymId)))
    .limit(1)

  if (!row) return null

  const { gymTimezone } = row

  const mStart = monthStart(gymTimezone)
  const mStartDate = monthStartDate(gymTimezone)

  // Round trip 2: seven independent queries in parallel.
  const [
    enrollmentRows,
    activePlans,
    recentVisits,
    [{ visitCount }],
    [{ adjustmentSum }],
    recentAdjustments,
    lastPayments,
  ] = await Promise.all([
    // Active enrollment + plan details
    db
      .select({
        planId: enrollments.planId,
        planName: membershipPlans.name,
        planType: membershipPlans.planType,
        creditsPerMonth: membershipPlans.creditsPerMonth,
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

    // All active plans in this gym (for the enroll dialog)
    db
      .select({
        id: membershipPlans.id,
        name: membershipPlans.name,
        planType: membershipPlans.planType,
        priceArs: membershipPlans.priceArs,
        creditsPerMonth: membershipPlans.creditsPerMonth,
      })
      .from(membershipPlans)
      .where(and(eq(membershipPlans.gymId, gymId), eq(membershipPlans.active, true))),

    // Last 30 visits for the history list
    db
      .select({
        id: visits.id,
        visitedAt: visits.visitedAt,
        channel: visits.channel,
        overLimit: visits.overLimit,
      })
      .from(visits)
      .where(and(eq(visits.memberId, memberId), eq(visits.gymId, gymId)))
      .orderBy(desc(visits.visitedAt))
      .limit(30),

    // Visits this month counted in SQL with gym timezone — not client-side JS.
    // Client-side filtering uses the server's UTC offset and is incorrect for
    // gyms in other timezones.
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

    // Credit adjustments sum this month
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

    // Last 20 adjustments for the history list
    db
      .select({
        id: creditAdjustments.id,
        amount: creditAdjustments.amount,
        date: creditAdjustments.date,
        notes: creditAdjustments.notes,
      })
      .from(creditAdjustments)
      .where(and(eq(creditAdjustments.memberId, memberId), eq(creditAdjustments.gymId, gymId)))
      .orderBy(desc(creditAdjustments.date))
      .limit(20),

    // Last 12 payment records
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
      .limit(12),
  ])

  const enrollment = enrollmentRows[0] ?? null
  const usedCreditsThisMonth = Number(visitCount)
  const adjustments = Number(adjustmentSum ?? 0)
  const isUnlimited = enrollment?.planType === 'unlimited'
  const creditsLeft = isUnlimited
    ? null
    : enrollment
      ? (enrollment.creditsPerMonth ?? 0) - usedCreditsThisMonth + adjustments
      : null

  return {
    member: {
      id: row.memberId,
      fullName: row.fullName,
      documentNumber: row.documentNumber,
      email: row.email,
      phone: row.phone,
      birthDate: row.birthDate,
      joinedAt: row.joinedAt,
      active: row.active,
      gymId,
    },
    gymTimezone,
    enrollment,
    activePlans,
    creditsLeft,
    usedCreditsThisMonth,
    recentVisits,
    lastPayments,
    recentAdjustments,
  }
}
