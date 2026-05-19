import { db } from '@/lib/db/client'
import { visits, enrollments, membershipPlans, creditAdjustments } from '@/lib/db/schema'
import { and, count, eq, gte, sql, sum } from 'drizzle-orm'

// Returns credits remaining for the current calendar month in the gym's timezone.
// Returns null if the member has no active enrollment.
// Returns Infinity if the plan is unlimited.
export async function getAvailableCredits(
  memberId: string,
  gymId: string,
  gymTimezone: string
): Promise<number | null> {
  const [enrollment] = await db
    .select({
      planType: membershipPlans.planType,
      creditsPerMonth: membershipPlans.creditsPerMonth,
    })
    .from(enrollments)
    .innerJoin(membershipPlans, eq(membershipPlans.id, enrollments.planId))
    .where(
      and(
        eq(enrollments.memberId, memberId),
        eq(enrollments.gymId, gymId),
        eq(enrollments.active, 'true')
      )
    )
    .limit(1)

  if (!enrollment) return null
  if (enrollment.planType === 'unlimited') return Infinity

  const monthStart = sql`(date_trunc('month', now() AT TIME ZONE ${gymTimezone}) AT TIME ZONE ${gymTimezone})`

  const [{ visitCount }] = await db
    .select({ visitCount: count() })
    .from(visits)
    .where(
      and(
        eq(visits.memberId, memberId),
        eq(visits.gymId, gymId),
        eq(visits.overLimit, 'false'),
        gte(visits.visitedAt, monthStart)
      )
    )

  const [{ adjustmentSum }] = await db
    .select({ adjustmentSum: sum(creditAdjustments.amount) })
    .from(creditAdjustments)
    .where(
      and(
        eq(creditAdjustments.memberId, memberId),
        eq(creditAdjustments.gymId, gymId),
        gte(creditAdjustments.date, sql`date_trunc('month', now() AT TIME ZONE ${gymTimezone})::date`)
      )
    )

  const adjustments = Number(adjustmentSum ?? 0)
  return (enrollment.creditsPerMonth ?? 0) - Number(visitCount) + adjustments
}
