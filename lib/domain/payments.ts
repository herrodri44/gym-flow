import { db } from '@/lib/db/client'
import { paymentRecords, members, enrollments, membershipPlans } from '@/lib/db/schema'
import { and, desc, eq, gte, lte } from 'drizzle-orm'

export type PaymentsFilters = {
  status?: string
  month?: string
}

export type PaymentRow = {
  id: string
  amountArs: number
  status: 'paid' | 'pending' | 'overdue'
  periodStart: Date
  periodEnd: Date
  paidAt: Date | null
  notes: string | null
  memberName: string
  memberId: string
}

export type ActiveMemberOption = {
  id: string
  fullName: string
  documentNumber: string
  enrollmentId: string | null
  planName: string | null
  priceArs: number | null
}

export type PaymentsPageData = {
  payments: PaymentRow[]
  activeMembers: ActiveMemberOption[]
  pendingOverdue: number
}

const validStatuses = ['paid', 'pending', 'overdue'] as const
type PaymentStatus = (typeof validStatuses)[number]

export async function getPaymentsPageData(
  gymId: string,
  filters: PaymentsFilters,
): Promise<PaymentsPageData> {
  const conditions = [eq(paymentRecords.gymId, gymId)]

  if (filters.status && validStatuses.includes(filters.status as PaymentStatus)) {
    conditions.push(eq(paymentRecords.status, filters.status as PaymentStatus))
  }

  if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    const [y, m] = filters.month.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0, 23, 59, 59)
    conditions.push(gte(paymentRecords.periodStart, start))
    conditions.push(lte(paymentRecords.periodStart, end))
  }

  const [payments, activeMembers] = await Promise.all([
    db
      .select({
        id: paymentRecords.id,
        amountArs: paymentRecords.amountArs,
        status: paymentRecords.status,
        periodStart: paymentRecords.periodStart,
        periodEnd: paymentRecords.periodEnd,
        paidAt: paymentRecords.paidAt,
        notes: paymentRecords.notes,
        memberName: members.fullName,
        memberId: members.id,
      })
      .from(paymentRecords)
      .innerJoin(members, eq(members.id, paymentRecords.memberId))
      .where(and(...conditions))
      .orderBy(desc(paymentRecords.periodStart), members.fullName),

    db
      .select({
        id: members.id,
        fullName: members.fullName,
        documentNumber: members.documentNumber,
        enrollmentId: enrollments.id,
        planName: membershipPlans.name,
        priceArs: membershipPlans.priceArs,
      })
      .from(members)
      .leftJoin(
        enrollments,
        and(
          eq(enrollments.memberId, members.id),
          eq(enrollments.active, 'true'),
          eq(enrollments.gymId, gymId),
        )
      )
      .leftJoin(membershipPlans, eq(membershipPlans.id, enrollments.planId))
      .where(and(eq(members.gymId, gymId), eq(members.active, 'true')))
      .orderBy(members.fullName),
  ])

  const now = new Date()
  const pendingOverdue = payments.filter(
    (p) => p.status === 'pending' && p.periodEnd < now
  ).length

  return { payments, activeMembers, pendingOverdue }
}
