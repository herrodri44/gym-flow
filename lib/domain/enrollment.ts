import { db } from '@/lib/db/client'
import { enrollments, membershipPlans, members, gyms } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'

type EnrollMemberParams = {
  gymId: string
  memberId: string
  planId: string
  startedAt?: Date
}

export async function enrollMember({
  gymId,
  memberId,
  planId,
  startedAt,
}: EnrollMemberParams): Promise<{ error: string } | { success: true }> {
  const [[member], [plan], [gym]] = await Promise.all([
    db.select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.gymId, gymId)))
      .limit(1),
    db.select({ id: membershipPlans.id, priceArs: membershipPlans.priceArs })
      .from(membershipPlans)
      .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.gymId, gymId)))
      .limit(1),
    db.select({ timezone: gyms.timezone })
      .from(gyms)
      .where(eq(gyms.id, gymId))
      .limit(1),
  ])

  if (!member) return { error: 'Socio no encontrado' }
  if (!plan) return { error: 'Plan no encontrado' }

  const tz = gym?.timezone ?? 'America/Argentina/Buenos_Aires'

  await db
    .update(enrollments)
    .set({ active: false, endedAt: new Date() })
    .where(and(
      eq(enrollments.memberId, memberId),
      eq(enrollments.gymId, gymId),
      eq(enrollments.active, true),
    ))

  const [newEnrollment] = await db
    .insert(enrollments)
    .values({ gymId, memberId, planId, startedAt: startedAt ?? new Date(), active: true })
    .returning({ id: enrollments.id })

  // Create a pending payment for the current month if one doesn't exist yet.
  // Uses INSERT ... WHERE NOT EXISTS so re-enrollments mid-month don't create duplicates.
  await db.execute(sql`
    INSERT INTO payment_records
      (id, gym_id, member_id, enrollment_id, amount_ars, currency, period_start, period_end, status)
    SELECT
      gen_random_uuid(),
      ${gymId}::uuid,
      ${memberId}::uuid,
      ${newEnrollment.id}::uuid,
      ${plan.priceArs},
      'ARS',
      date_trunc('month', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz},
      (date_trunc('month', now() AT TIME ZONE ${tz}) + interval '1 month' - interval '1 second') AT TIME ZONE ${tz},
      'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM payment_records
      WHERE member_id   = ${memberId}::uuid
        AND gym_id      = ${gymId}::uuid
        AND period_start >= date_trunc('month', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}
        AND period_start <  (date_trunc('month', now() AT TIME ZONE ${tz}) + interval '1 month') AT TIME ZONE ${tz}
    )
  `)

  return { success: true }
}
