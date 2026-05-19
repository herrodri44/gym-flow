import { db } from '@/lib/db/client'
import { gyms, members, enrollments, membershipPlans, visits, paymentRecords } from '@/lib/db/schema'
import { and, asc, count, eq, exists, gte, ilike, inArray, lte, max, or, sql } from 'drizzle-orm'

export const MEMBERS_PAGE_SIZE = 25

export type MembersListFilters = {
  q: string
  status: 'active' | 'inactive' | 'all'
  payment: 'all' | 'paid' | 'pending' | 'overdue'
  page: number
}

export type MemberRow = {
  id: string
  fullName: string
  documentNumber: string
  phone: string | null
  email: string | null
  birthDate: string | null
  joinedAt: string | null
  active: string
  enrollment: {
    planName: string
    planType: 'credits' | 'unlimited'
    creditsPerMonth: number | null
  } | null
  usedCredits: number
  /** null = unlimited plan or no plan */
  availableCredits: number | null
  lastVisit: Date | null
  hasPaid: boolean
}

export type MembersListData = {
  rows: MemberRow[]
  total: number
  totalPages: number
}

const validPaymentStatuses = ['paid', 'pending', 'overdue'] as const
type PaymentStatus = (typeof validPaymentStatuses)[number]

export async function getMembersList(
  gymId: string,
  filters: MembersListFilters
): Promise<MembersListData> {
  const { q, status, payment, page } = filters

  const searchFilter = q
    ? or(ilike(members.fullName, `%${q}%`), ilike(members.documentNumber, `%${q}%`))
    : undefined

  const statusFilter =
    status === 'inactive'
      ? eq(members.active, 'false')
      : status === 'all'
        ? undefined
        : eq(members.active, 'true')

  const paymentFilter = validPaymentStatuses.includes(payment as PaymentStatus)
    ? exists(
        db
          .select({ x: sql`1` })
          .from(paymentRecords)
          .where(
            and(
              eq(paymentRecords.memberId, members.id),
              eq(paymentRecords.gymId, gymId),
              eq(paymentRecords.status, payment as PaymentStatus),
              lte(paymentRecords.periodStart, sql`now()`),
              gte(paymentRecords.periodEnd, sql`now()`)
            )
          )
      )
    : undefined

  const baseWhere = and(eq(members.gymId, gymId), statusFilter, searchFilter, paymentFilter)

  // Round trip 1: gym timezone, total count, and member rows all run in parallel.
  // baseWhere does not depend on gymTimezone, so all three can fire at once.
  const [[gymRow], [{ total }], memberRows] = await Promise.all([
    db
      .select({ timezone: gyms.timezone })
      .from(gyms)
      .where(eq(gyms.id, gymId))
      .limit(1),

    db
      .select({ total: count() })
      .from(members)
      .where(baseWhere),

    db
      .select({
        id: members.id,
        fullName: members.fullName,
        documentNumber: members.documentNumber,
        phone: members.phone,
        email: members.email,
        birthDate: members.birthDate,
        joinedAt: members.joinedAt,
        active: members.active,
      })
      .from(members)
      .where(baseWhere)
      .orderBy(asc(members.fullName))
      .limit(MEMBERS_PAGE_SIZE)
      .offset((page - 1) * MEMBERS_PAGE_SIZE),
  ])

  const gymTimezone = gymRow?.timezone ?? 'America/Argentina/Buenos_Aires'
  const memberIds = memberRows.map((r) => r.id)

  // Round trip 2: four enrichment queries in parallel, keyed by memberId.
  // Skipped entirely when the page returns no results.
  const [enrollmentRows, visitCountRows, lastVisitRows, paidMemberRows] =
    memberIds.length > 0
      ? await Promise.all([
          db
            .select({
              memberId: enrollments.memberId,
              planName: membershipPlans.name,
              planType: membershipPlans.planType,
              creditsPerMonth: membershipPlans.creditsPerMonth,
            })
            .from(enrollments)
            .innerJoin(membershipPlans, eq(membershipPlans.id, enrollments.planId))
            .where(
              and(
                inArray(enrollments.memberId, memberIds),
                eq(enrollments.gymId, gymId),
                eq(enrollments.active, 'true')
              )
            ),

          db
            .select({ memberId: visits.memberId, n: count() })
            .from(visits)
            .where(
              and(
                inArray(visits.memberId, memberIds),
                eq(visits.gymId, gymId),
                eq(visits.overLimit, 'false'),
                gte(
                  visits.visitedAt,
                  sql`(date_trunc('month', now() AT TIME ZONE ${gymTimezone}) AT TIME ZONE ${gymTimezone})`
                )
              )
            )
            .groupBy(visits.memberId),

          db
            .select({ memberId: visits.memberId, lastVisit: max(visits.visitedAt) })
            .from(visits)
            .where(and(inArray(visits.memberId, memberIds), eq(visits.gymId, gymId)))
            .groupBy(visits.memberId),

          db
            .selectDistinct({ memberId: paymentRecords.memberId })
            .from(paymentRecords)
            .where(
              and(
                inArray(paymentRecords.memberId, memberIds),
                eq(paymentRecords.gymId, gymId),
                eq(paymentRecords.status, 'paid'),
                lte(paymentRecords.periodStart, sql`now()`),
                gte(paymentRecords.periodEnd, sql`now()`)
              )
            ),
        ])
      : [[], [], [], []]

  const enrollMap = new Map(enrollmentRows.map((e) => [e.memberId, e]))
  const visitMap = new Map(visitCountRows.map((v) => [v.memberId, Number(v.n)]))
  const lastVisitMap = new Map(lastVisitRows.map((v) => [v.memberId, v.lastVisit]))
  const paidSet = new Set(paidMemberRows.map((r) => r.memberId))

  const rows: MemberRow[] = memberRows.map((m) => {
    const enrollment = enrollMap.get(m.id) ?? null
    const usedCredits = visitMap.get(m.id) ?? 0
    const isUnlimited = enrollment?.planType === 'unlimited'
    const availableCredits =
      enrollment && !isUnlimited ? (enrollment.creditsPerMonth ?? 0) - usedCredits : null

    return {
      ...m,
      enrollment,
      usedCredits,
      availableCredits,
      lastVisit: lastVisitMap.get(m.id) ?? null,
      hasPaid: paidSet.has(m.id),
    }
  })

  return {
    rows,
    total: Number(total),
    totalPages: Math.ceil(Number(total) / MEMBERS_PAGE_SIZE),
  }
}
