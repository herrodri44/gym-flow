// Integration test helpers. Each test file creates its own gym and deletes it
// afterwards (everything cascades from gyms), so tests never depend on seed data.

import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'

if (!/@(127\.0\.0\.1|localhost)[:/]/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Integration tests must run against the local database (.env.development.local).')
}

const { db } = await import('@/lib/db/client')
export { db }

export type TestGym = {
  gymId: string
  adminId: string
  plans: { credits12: string; credits1: string; unlimited: string; archived: string }
}

// billingCutoverDate defaults to the distant past so grace counts from each
// member's own expiry; pass a date to test the cutover rule.
export async function createTestGym(
  settings: { graceDays?: number; allowOverLimit?: boolean; billingCutoverDate?: string } = {},
): Promise<TestGym> {
  const [gym] = await db.execute<{ id: string }>(sql`
    INSERT INTO gyms (name, slug, timezone)
    VALUES ('Test Gym', ${'test-' + randomUUID()}, 'America/Argentina/Buenos_Aires')
    RETURNING id`)
  await db.execute(sql`
    INSERT INTO gym_settings (gym_id, grace_days, allow_over_limit, billing_cutover_date)
    VALUES (${gym.id}::uuid, ${settings.graceDays ?? 0}, ${settings.allowOverLimit ?? false},
            ${settings.billingCutoverDate ?? '2000-01-01'}::date)`)

  const adminId = randomUUID()
  await db.execute(sql`
    INSERT INTO profiles (id, role, full_name, email)
    VALUES (${adminId}::uuid, 'gym_admin', 'Test Admin', ${adminId + '@test.local'})`)

  const plan = async (name: string, type: 'credits' | 'unlimited', credits: number | null, active = true) => {
    const [row] = await db.execute<{ id: string }>(sql`
      INSERT INTO membership_plans (gym_id, name, plan_type, price_ars, credits_per_month, active)
      VALUES (${gym.id}::uuid, ${name}, ${type}, 3000000, ${credits}, ${active})
      RETURNING id`)
    return row.id
  }

  return {
    gymId: gym.id,
    adminId,
    plans: {
      credits12: await plan('12 clases', 'credits', 12),
      credits1: await plan('1 clase', 'credits', 1),
      unlimited: await plan('Libre', 'unlimited', null),
      archived: await plan('Viejo', 'credits', 8, false),
    },
  }
}

export async function deleteTestGym(gym: TestGym) {
  await db.execute(sql`DELETE FROM gyms WHERE id = ${gym.gymId}::uuid`)
  await db.execute(sql`DELETE FROM profiles WHERE id = ${gym.adminId}::uuid`)
}

export async function createMember(gymId: string, name = 'Socio Test') {
  const [row] = await db.execute<{ id: string }>(sql`
    INSERT INTO members (gym_id, document_number, full_name)
    VALUES (${gymId}::uuid, ${String(Math.floor(Math.random() * 1e9))}, ${name})
    RETURNING id`)
  return { id: row.id, fullName: name, documentNumber: '' }
}

export async function gymToday(): Promise<string> {
  const [row] = await db.execute<{ today: string }>(
    sql`SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date::text AS today`,
  )
  return row.today
}

// Insert a visit on an arbitrary past date (recordVisit always uses today).
export async function insertVisitOn(gymId: string, memberId: string, date: string, periodId: string | null = null) {
  await db.execute(sql`
    INSERT INTO visits (gym_id, member_id, visited_at, visit_date, channel, period_id)
    VALUES (${gymId}::uuid, ${memberId}::uuid,
            (${date}::date + time '18:00') AT TIME ZONE 'America/Argentina/Buenos_Aires',
            ${date}::date, 'fichaje_admin', ${periodId}::uuid)`)
}

export async function periodsOf(memberId: string) {
  return db.execute<{ id: string; start_date: string; end_date: string; anchor_day: number }>(sql`
    SELECT id, start_date::text, end_date::text, anchor_day
    FROM membership_periods WHERE member_id = ${memberId}::uuid ORDER BY start_date`)
}
