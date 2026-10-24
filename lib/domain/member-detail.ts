import { db } from '@/lib/db/client'
import { members, visits, creditAdjustments } from '@/lib/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { getMemberStanding, type MemberStanding } from './standing'
import {
  getActivePlans,
  getMemberPaymentOptions,
  type MemberPaymentOption,
  type PlanOption,
} from './payments'

export type PeriodHistoryRow = {
  id: string
  paymentId: string
  planName: string
  planType: 'credits' | 'unlimited'
  startDate: string
  endDate: string
  creditsGranted: number | null
  creditsUsed: number
  amountArs: number
  paidOn: string
  notes: string | null
}

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
    notes: string | null
  }
  standing: MemberStanding | null
  /** Prefill for the register-payment dialog; null for inactive members. */
  paymentOption: MemberPaymentOption | null
  plans: PlanOption[]
  periods: PeriodHistoryRow[]
  recentVisits: Array<{
    id: string
    visitedAt: Date
    channel: string
    overLimit: boolean
    /** Visit not attached to any period (grace or pre-period) */
    unassigned: boolean
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
  gymId: string,
): Promise<MemberDetailData | null> {
  // Round trip 1: the member (also verifies it belongs to this gym).
  const [member] = await db
    .select({
      id: members.id,
      fullName: members.fullName,
      documentNumber: members.documentNumber,
      email: members.email,
      phone: members.phone,
      birthDate: members.birthDate,
      joinedAt: members.joinedAt,
      active: members.active,
      notes: members.notes,
    })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.gymId, gymId)))
    .limit(1)

  if (!member) return null

  // Round trip 2: everything else in parallel.
  const [standing, paymentOptions, plans, periods, recentVisits, recentAdjustments] = await Promise.all([
    getMemberStanding(memberId, gymId),
    getMemberPaymentOptions(gymId, memberId),
    getActivePlans(gymId),

    db.execute<{
      id: string
      payment_id: string
      plan_name: string
      plan_type: 'credits' | 'unlimited'
      start_date: string
      end_date: string
      credits_granted: number | null
      credits_used: number
      amount_ars: number
      paid_on: string
      notes: string | null
    }>(sql`
      SELECT p.id, p.payment_id, mp.name AS plan_name, p.plan_type,
             p.start_date::text, p.end_date::text, p.credits_granted,
             (SELECT count(*)::int FROM visits v WHERE v.period_id = p.id AND v.over_limit = false) AS credits_used,
             pr.amount_ars, (pr.paid_at AT TIME ZONE g.timezone)::date::text AS paid_on, pr.notes
      FROM membership_periods p
      JOIN membership_plans mp ON mp.id = p.plan_id
      JOIN payment_records pr ON pr.id = p.payment_id
      JOIN gyms g ON g.id = p.gym_id
      WHERE p.member_id = ${memberId}::uuid AND p.gym_id = ${gymId}::uuid
      ORDER BY p.start_date DESC
      LIMIT 12
    `),

    db
      .select({
        id: visits.id,
        visitedAt: visits.visitedAt,
        channel: visits.channel,
        overLimit: visits.overLimit,
        periodId: visits.periodId,
      })
      .from(visits)
      .where(and(eq(visits.memberId, memberId), eq(visits.gymId, gymId)))
      .orderBy(desc(visits.visitedAt))
      .limit(30),

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
  ])

  return {
    member,
    standing,
    paymentOption: paymentOptions[0] ?? null,
    plans,
    periods: periods.map((p) => ({
      id: p.id,
      paymentId: p.payment_id,
      planName: p.plan_name,
      planType: p.plan_type,
      startDate: p.start_date,
      endDate: p.end_date,
      creditsGranted: p.credits_granted === null ? null : Number(p.credits_granted),
      creditsUsed: Number(p.credits_used),
      amountArs: Number(p.amount_ars),
      paidOn: p.paid_on,
      notes: p.notes,
    })),
    recentVisits: recentVisits.map(({ periodId, ...v }) => ({ ...v, unassigned: periodId === null })),
    recentAdjustments,
  }
}
