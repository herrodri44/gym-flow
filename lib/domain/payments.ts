import { db } from '@/lib/db/client'
import { membershipPeriods, membershipPlans, paymentRecords } from '@/lib/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { PG_EXCLUSION_VIOLATION, pgErrorCode } from '@/lib/db/errors'
import { calculateNextPeriod, type PeriodDates } from './period-math'
import type { MemberStandingStatus } from '@/lib/db/schema'

// ─── Reads ────────────────────────────────────────────────────────────────────

export type PaymentRow = {
  id: string
  amountArs: number
  paidOn: string // gym-local date
  notes: string | null
  memberId: string
  memberName: string
  planName: string | null
  startDate: string | null
  endDate: string | null
}

// Everything the register-payment dialog needs to prefill and preview the
// resulting period client-side with calculateNextPeriod.
export type MemberPaymentOption = {
  id: string
  fullName: string
  documentNumber: string
  status: MemberStandingStatus
  lastPlanId: string | null
  /** Latest period (may be a queued future one) — the basis for the next period. */
  lastPeriodEnd: string | null
  lastAnchorDay: number | null
}

export type PlanOption = {
  id: string
  name: string
  planType: 'credits' | 'unlimited'
  priceArs: number
  creditsPerMonth: number | null
}

export type PaymentsPageData = {
  payments: PaymentRow[]
  totalCollected: number
  month: string // YYYY-MM
  today: string
  members: MemberPaymentOption[]
  plans: PlanOption[]
}

export async function getPaymentsPageData(
  gymId: string,
  filters: { month?: string },
): Promise<PaymentsPageData> {
  // Round trip 1: gym-local today (defines the default month).
  const [gym] = await db.execute<{ timezone: string; today: string }>(sql`
    SELECT timezone, (now() AT TIME ZONE timezone)::date::text AS today
    FROM gyms WHERE id = ${gymId}::uuid
  `)
  const tz = gym?.timezone ?? 'America/Argentina/Buenos_Aires'
  const today = gym?.today ?? new Date().toISOString().slice(0, 10)
  const month = filters.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(filters.month) ? filters.month : today.slice(0, 7)

  // Round trip 2: ledger for the month, dialog options, plans.
  const [payments, members, plans] = await Promise.all([
    db.execute<{
      id: string
      amount_ars: number
      paid_on: string
      notes: string | null
      member_id: string
      member_name: string
      plan_name: string | null
      start_date: string | null
      end_date: string | null
    }>(sql`
      SELECT pr.id, pr.amount_ars, (pr.paid_at AT TIME ZONE ${tz})::date::text AS paid_on, pr.notes,
             m.id AS member_id, m.full_name AS member_name,
             mp.name AS plan_name, p.start_date::text AS start_date, p.end_date::text AS end_date
      FROM payment_records pr
      JOIN members m ON m.id = pr.member_id
      LEFT JOIN membership_periods p ON p.payment_id = pr.id
      LEFT JOIN membership_plans mp ON mp.id = p.plan_id
      WHERE pr.gym_id = ${gymId}::uuid
        AND to_char(pr.paid_at AT TIME ZONE ${tz}, 'YYYY-MM') = ${month}
      ORDER BY pr.paid_at DESC, m.full_name
    `),
    getMemberPaymentOptions(gymId),
    getActivePlans(gymId),
  ])

  const rows: PaymentRow[] = payments.map((r) => ({
    id: r.id,
    amountArs: Number(r.amount_ars),
    paidOn: r.paid_on,
    notes: r.notes,
    memberId: r.member_id,
    memberName: r.member_name,
    planName: r.plan_name,
    startDate: r.start_date,
    endDate: r.end_date,
  }))

  return {
    payments: rows,
    totalCollected: rows.reduce((sum, r) => sum + r.amountArs, 0),
    month,
    today,
    members,
    plans,
  }
}

export async function getMemberPaymentOptions(
  gymId: string,
  memberId?: string,
): Promise<MemberPaymentOption[]> {
  const rows = await db.execute<{
    id: string
    full_name: string
    document_number: string
    status: MemberStandingStatus
    last_plan_id: string | null
    last_period_end: string | null
    last_anchor_day: number | null
  }>(sql`
    SELECT m.id, m.full_name, m.document_number, s.status,
           lp.plan_id AS last_plan_id, lp.end_date::text AS last_period_end, lp.anchor_day AS last_anchor_day
    FROM members m
    JOIN member_standing s ON s.member_id = m.id
    LEFT JOIN LATERAL (
      SELECT plan_id, end_date, anchor_day FROM membership_periods p
      WHERE p.member_id = m.id ORDER BY p.end_date DESC LIMIT 1
    ) lp ON true
    WHERE m.gym_id = ${gymId}::uuid
      AND m.active = true
      ${memberId ? sql`AND m.id = ${memberId}::uuid` : sql``}
    ORDER BY m.full_name
  `)
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    documentNumber: r.document_number,
    status: r.status,
    lastPlanId: r.last_plan_id,
    lastPeriodEnd: r.last_period_end,
    lastAnchorDay: r.last_anchor_day === null ? null : Number(r.last_anchor_day),
  }))
}

export async function getActivePlans(gymId: string): Promise<PlanOption[]> {
  return db
    .select({
      id: membershipPlans.id,
      name: membershipPlans.name,
      planType: membershipPlans.planType,
      priceArs: membershipPlans.priceArs,
      creditsPerMonth: membershipPlans.creditsPerMonth,
    })
    .from(membershipPlans)
    .where(and(eq(membershipPlans.gymId, gymId), eq(membershipPlans.active, true)))
    .orderBy(membershipPlans.name)
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export type RecordPaymentInput = {
  gymId: string
  memberId: string
  planId: string
  amountArs: number // centavos
  /** Gym-local date the money was received. Defaults to today. */
  paymentDate?: string
  /** Admin override of the period start (B2). */
  startDate?: string
  notes?: string | null
}

export type RecordPaymentResult = { error: string } | { success: true; period: PeriodDates }

// Records a payment and the period it buys, atomically:
//   1. lock the member row (serializes concurrent payments for one member)
//   2. compute the period from the member's latest one (B1–B4)
//   3. insert payment + period
//   4. attach unassigned visits: grace visits after the previous period ended
//      (B5) and any visits inside the new period (backdated start)
export async function recordPayment(input: RecordPaymentInput): Promise<RecordPaymentResult> {
  const { gymId, memberId, planId, amountArs, notes } = input

  try {
    return await db.transaction(async (tx) => {
      const [member] = await tx.execute<{
        timezone: string
        today: string
        grace_days: number
        billing_cutover_date: string | null
      }>(sql`
        SELECT g.timezone, (now() AT TIME ZONE g.timezone)::date::text AS today,
               COALESCE(gs.grace_days, 0) AS grace_days,
               gs.billing_cutover_date::text AS billing_cutover_date
        FROM members m
        JOIN gyms g ON g.id = m.gym_id
        LEFT JOIN gym_settings gs ON gs.gym_id = m.gym_id
        WHERE m.id = ${memberId}::uuid AND m.gym_id = ${gymId}::uuid
        FOR UPDATE OF m
      `)
      if (!member) return { error: 'Socio no encontrado' }

      const [plan] = await tx
        .select({
          planType: membershipPlans.planType,
          creditsPerMonth: membershipPlans.creditsPerMonth,
          active: membershipPlans.active,
        })
        .from(membershipPlans)
        .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.gymId, gymId)))
        .limit(1)
      if (!plan) return { error: 'Plan no encontrado' }
      if (!plan.active) return { error: 'El plan está archivado' }

      const paymentDate = input.paymentDate ?? member.today
      if (paymentDate > member.today) return { error: 'La fecha de pago no puede ser futura' }

      const [last] = await tx
        .select({ endDate: membershipPeriods.endDate, anchorDay: membershipPeriods.anchorDay })
        .from(membershipPeriods)
        .where(eq(membershipPeriods.memberId, memberId))
        .orderBy(desc(membershipPeriods.endDate))
        .limit(1)

      const period = calculateNextPeriod({
        lastPeriod: last ?? null,
        paymentDate,
        startOverride: input.startDate,
      })
      if ('error' in period) {
        return {
          error:
            period.error === 'overlaps_previous_period'
              ? `El inicio no puede ser anterior al ${formatDay(last!.endDate)}, cuando termina el período actual`
              : 'Fecha inválida',
        }
      }

      const [payment] = await tx
        .insert(paymentRecords)
        .values({
          gymId,
          memberId,
          amountArs,
          // Today → exact time; a past date → noon gym-local of that day.
          paidAt:
            paymentDate === member.today
              ? sql`now()`
              : sql`(${paymentDate}::date + time '12:00') AT TIME ZONE ${member.timezone}`,
          notes: notes ?? null,
        })
        .returning({ id: paymentRecords.id })

      const [created] = await tx
        .insert(membershipPeriods)
        .values({
          gymId,
          memberId,
          paymentId: payment.id,
          planId,
          planType: plan.planType,
          creditsGranted: plan.planType === 'credits' ? (plan.creditsPerMonth ?? 0) : null,
          priceArs: amountArs,
          startDate: period.startDate,
          endDate: period.endDate,
          anchorDay: period.anchorDay,
        })
        .returning({ id: membershipPeriods.id })

      // Grace starts at the later of the previous period's end and the gym's
      // billing cutover, so visits from before the switch never use new credits.
      const graceStart = sql`GREATEST(${last?.endDate ?? null}::date, ${member.billing_cutover_date}::date)`
      await tx.execute(sql`
        UPDATE visits SET period_id = ${created.id}::uuid
        WHERE member_id = ${memberId}::uuid
          AND period_id IS NULL
          AND (
            (visit_date >= ${period.startDate}::date AND visit_date < ${period.endDate}::date)
            ${
              last
                ? sql`OR (visit_date >= ${graceStart} AND visit_date < ${graceStart} + ${Number(member.grace_days)}::int)`
                : sql``
            }
          )
      `)

      return { success: true as const, period }
    })
  } catch (e) {
    if (pgErrorCode(e) === PG_EXCLUSION_VIOLATION) {
      return { error: 'El período se superpone con otro ya registrado. Recargá la página e intentá de nuevo.' }
    }
    throw e
  }
}

// Deleting a payment deletes its period (cascade); visits it covered become
// unassigned and are re-attached by the next payment covering their dates.
export async function deletePayment(
  gymId: string,
  paymentId: string,
): Promise<{ error: string } | { success: true }> {
  const deleted = await db
    .delete(paymentRecords)
    .where(and(eq(paymentRecords.id, paymentId), eq(paymentRecords.gymId, gymId)))
    .returning({ id: paymentRecords.id })
  if (deleted.length === 0) return { error: 'Pago no encontrado' }
  return { success: true }
}

function formatDay(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}
