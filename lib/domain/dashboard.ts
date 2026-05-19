import { db } from '@/lib/db/client'
import { gyms, gymSettings } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { monthStart, monthStartDate } from '@/lib/db/time'

export interface KpiData {
  activeMembers: number
  inactiveMembers: number
  visitedLast7Days: number
  visitedThisMonth: number
  paidThisMonth: number
  unpaidThisMonth: number
  collectedThisMonth: number   // centavos ARS
  pendingAmountThisMonth: number // centavos ARS
  zeroCredits: number
  lowCredits: number
  lowCreditsThreshold: number
}

// Member who hasn't paid this month — split by whether they visited this month or not
export interface UnpaidMember {
  id: string
  fullName: string
  documentNumber: string
  planName: string | null
  availableCredits: number | null // null = unlimited plan
  lastVisit: Date | null          // last visit ever for absent; last this month for visiting
  visitsThisMonth: number
}

export interface UnpaidMembersData {
  visiting: UnpaidMember[]  // unpaid + at least 1 visit this month
  absent: UnpaidMember[]    // unpaid + no visit this month
}

export interface ChartPoint {
  label: string
  value: number
}

export type DashboardContext = {
  gymName: string
  gymTimezone: string
  lowCreditsThreshold: number
}

export async function getDashboardContext(gymId: string): Promise<DashboardContext> {
  const [row] = await db
    .select({
      name: gyms.name,
      timezone: gyms.timezone,
      lowCreditsThreshold: gymSettings.lowCreditsThreshold,
    })
    .from(gyms)
    .leftJoin(gymSettings, eq(gymSettings.gymId, gyms.id))
    .where(eq(gyms.id, gymId))
    .limit(1)

  return {
    gymName: row?.name ?? 'Mi Gym',
    gymTimezone: row?.timezone ?? 'America/Argentina/Buenos_Aires',
    lowCreditsThreshold: row?.lowCreditsThreshold ?? 2,
  }
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function toMonthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-')
  return `${MONTHS_ES[Number(month) - 1]} ${year.slice(2)}`
}

// Shared CTE fragment used in both unpaid queries
function unpaidBaseSql(gymId: string, gymTimezone: string) {
  return sql`
    month_ts AS (
      SELECT
        ${monthStart(gymTimezone)} AS start_ts,
        ${monthStartDate(gymTimezone)} AS start_date
    ),
    unpaid_enrolled AS (
      SELECT DISTINCT ON (e.member_id)
        e.member_id,
        mp.name        AS plan_name,
        mp.plan_type,
        mp.credits_per_month
      FROM enrollments e
      JOIN members m  ON m.id = e.member_id AND m.active = 'true'
      JOIN membership_plans mp ON mp.id = e.plan_id
      WHERE e.gym_id = ${gymId}::uuid AND e.active = 'true'
        AND e.member_id NOT IN (
          SELECT DISTINCT member_id
          FROM payment_records
          WHERE gym_id = ${gymId}::uuid
            AND status = 'paid'
            AND period_start <= now()
            AND period_end   >= now()
        )
      ORDER BY e.member_id, e.started_at DESC
    ),
    credits_calc AS (
      SELECT
        ue.member_id,
        CASE WHEN ue.plan_type = 'credits' THEN
          ue.credits_per_month
          - COALESCE(
              (SELECT COUNT(*)::int FROM visits v
               WHERE v.member_id = ue.member_id AND v.gym_id = ${gymId}::uuid
               AND v.over_limit = 'false'
               AND v.visited_at >= (SELECT start_ts FROM month_ts)),
              0
            )
          + COALESCE(
              (SELECT SUM(ca.amount)::int FROM credit_adjustments ca
               WHERE ca.member_id = ue.member_id AND ca.gym_id = ${gymId}::uuid
               AND ca.date >= (SELECT start_date FROM month_ts)),
              0
            )
        ELSE NULL END AS available_credits
      FROM unpaid_enrolled ue
    )
  `
}

export async function getKpis(
  gymId: string,
  gymTimezone: string,
  lowCreditsThreshold: number,
): Promise<KpiData> {
  const [memberCounts, visitStats, paymentStats, creditsStats] = await Promise.all([
    db.execute<{ active_count: number; inactive_count: number }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE active = 'true')::int  AS active_count,
        COUNT(*) FILTER (WHERE active = 'false')::int AS inactive_count
      FROM members
      WHERE gym_id = ${gymId}::uuid
    `),

    db.execute<{ visited_7d: number; visited_month: number }>(sql`
      SELECT
        COUNT(DISTINCT member_id) FILTER (
          WHERE visited_at >= now() - interval '7 days'
        )::int AS visited_7d,
        COUNT(DISTINCT member_id) FILTER (
          WHERE visited_at >= ${monthStart(gymTimezone)}
        )::int AS visited_month
      FROM visits
      WHERE gym_id = ${gymId}::uuid
        AND visited_at >= LEAST(
          now() - interval '7 days',
          ${monthStart(gymTimezone)}
        )
    `),

    db.execute<{ paid: number; total_enrolled: number; collected: string; pending_amt: string }>(sql`
      WITH active_enrolled AS (
        SELECT DISTINCT e.member_id
        FROM enrollments e
        JOIN members m ON m.id = e.member_id
        WHERE e.gym_id = ${gymId}::uuid AND e.active = 'true' AND m.active = 'true'
      ),
      paid_members AS (
        SELECT DISTINCT member_id
        FROM payment_records
        WHERE gym_id = ${gymId}::uuid
          AND status = 'paid'
          AND period_start <= now()
          AND period_end   >= now()
      ),
      amounts AS (
        SELECT
          COALESCE(SUM(amount_ars) FILTER (WHERE status = 'paid'
            AND period_start <= now() AND period_end >= now()), 0)::bigint AS collected,
          COALESCE(SUM(amount_ars) FILTER (WHERE status IN ('pending', 'overdue')
            AND period_start <= now() AND period_end >= now()), 0)::bigint AS pending_amt
        FROM payment_records
        WHERE gym_id = ${gymId}::uuid
      )
      SELECT
        COUNT(ae.member_id) FILTER (WHERE pm.member_id IS NOT NULL)::int AS paid,
        COUNT(ae.member_id)::int AS total_enrolled,
        (SELECT collected  FROM amounts) AS collected,
        (SELECT pending_amt FROM amounts) AS pending_amt
      FROM active_enrolled ae
      LEFT JOIN paid_members pm ON pm.member_id = ae.member_id
    `),

    db.execute<{ zero_credits: number; low_credits: number }>(sql`
      WITH member_credits AS (
        SELECT (
          mp.credits_per_month
          - COALESCE(
              (SELECT COUNT(*)::int FROM visits v
               WHERE v.member_id = m.id AND v.gym_id = ${gymId}::uuid
               AND v.over_limit = 'false'
               AND v.visited_at >= ${monthStart(gymTimezone)}),
              0
            )
          + COALESCE(
              (SELECT SUM(ca.amount)::int FROM credit_adjustments ca
               WHERE ca.member_id = m.id AND ca.gym_id = ${gymId}::uuid
               AND ca.date >= ${monthStartDate(gymTimezone)}),
              0
            )
        ) AS available_credits
        FROM members m
        JOIN enrollments e  ON e.member_id = m.id AND e.gym_id = ${gymId}::uuid AND e.active = 'true'
        JOIN membership_plans mp ON mp.id = e.plan_id AND mp.plan_type = 'credits'
        WHERE m.gym_id = ${gymId}::uuid AND m.active = 'true'
      )
      SELECT
        COALESCE(COUNT(*) FILTER (WHERE available_credits <= 0), 0)::int                                               AS zero_credits,
        COALESCE(COUNT(*) FILTER (WHERE available_credits > 0 AND available_credits <= ${lowCreditsThreshold}), 0)::int AS low_credits
      FROM member_credits
    `),
  ])

  const mc = memberCounts[0]
  const vs = visitStats[0]
  const ps = paymentStats[0]
  const cs = creditsStats[0]

  return {
    activeMembers:    Number(mc?.active_count   ?? 0),
    inactiveMembers:  Number(mc?.inactive_count  ?? 0),
    visitedLast7Days:  Number(vs?.visited_7d     ?? 0),
    visitedThisMonth:  Number(vs?.visited_month  ?? 0),
    paidThisMonth:          Number(ps?.paid           ?? 0),
    unpaidThisMonth:        Number(ps?.total_enrolled ?? 0) - Number(ps?.paid ?? 0),
    collectedThisMonth:     Number(ps?.collected      ?? 0),
    pendingAmountThisMonth: Number(ps?.pending_amt    ?? 0),
    zeroCredits:      Number(cs?.zero_credits    ?? 0),
    lowCredits:       Number(cs?.low_credits     ?? 0),
    lowCreditsThreshold,
  }
}

type UnpaidRow = {
  id: string
  full_name: string
  document_number: string
  plan_name: string | null
  available_credits: number | null
  visits_this_month: number
  last_visit: Date | null
}

function toUnpaidMember(r: UnpaidRow): UnpaidMember {
  return {
    id: r.id,
    fullName: r.full_name,
    documentNumber: r.document_number,
    planName: r.plan_name,
    availableCredits: r.available_credits !== null ? Number(r.available_credits) : null,
    visitsThisMonth: Number(r.visits_this_month),
    lastVisit: r.last_visit ? new Date(r.last_visit) : null,
  }
}

export async function getUnpaidMembers(
  gymId: string,
  gymTimezone: string,
): Promise<UnpaidMembersData> {
  const base = unpaidBaseSql(gymId, gymTimezone)

  const [visitingRows, absentRows] = await Promise.all([
    // Unpaid members who visited at least once this month
    db.execute<UnpaidRow>(sql`
      WITH ${base},
      month_visits AS (
        SELECT member_id, COUNT(*)::int AS cnt, MAX(visited_at) AS last_visit
        FROM visits
        WHERE gym_id = ${gymId}::uuid
          AND visited_at >= (SELECT start_ts FROM month_ts)
        GROUP BY member_id
        HAVING COUNT(*) > 0
      )
      SELECT
        m.id, m.full_name, m.document_number,
        ue.plan_name,
        cc.available_credits,
        mv.cnt  AS visits_this_month,
        mv.last_visit
      FROM unpaid_enrolled ue
      JOIN members m        ON m.id  = ue.member_id
      JOIN credits_calc cc  ON cc.member_id = ue.member_id
      JOIN month_visits mv  ON mv.member_id = ue.member_id
      ORDER BY mv.last_visit ASC
      LIMIT 10
    `),

    // Unpaid members who did NOT visit this month — ordered by last visit ever (longest absent first)
    db.execute<UnpaidRow>(sql`
      WITH ${base},
      visited_ids AS (
        SELECT DISTINCT member_id
        FROM visits
        WHERE gym_id = ${gymId}::uuid
          AND visited_at >= (SELECT start_ts FROM month_ts)
      ),
      last_visit_ever AS (
        SELECT member_id, MAX(visited_at) AS last_visit
        FROM visits
        WHERE gym_id = ${gymId}::uuid
        GROUP BY member_id
      )
      SELECT
        m.id, m.full_name, m.document_number,
        ue.plan_name,
        cc.available_credits,
        0              AS visits_this_month,
        lve.last_visit
      FROM unpaid_enrolled ue
      JOIN members m        ON m.id  = ue.member_id
      JOIN credits_calc cc  ON cc.member_id = ue.member_id
      LEFT JOIN visited_ids vi  ON vi.member_id  = ue.member_id
      LEFT JOIN last_visit_ever lve ON lve.member_id = ue.member_id
      WHERE vi.member_id IS NULL
      ORDER BY lve.last_visit ASC NULLS LAST
      LIMIT 10
    `),
  ])

  return {
    visiting: visitingRows.map(toUnpaidMember),
    absent:   absentRows.map(toUnpaidMember),
  }
}

export async function getVisitsChartData(
  gymId: string,
  gymTimezone: string,
): Promise<ChartPoint[]> {
  const rows = await db.execute<{ month_key: string; unique_members: number }>(sql`
    WITH months AS (
      SELECT generate_series(
        ${monthStart(gymTimezone)} - interval '11 months',
        ${monthStart(gymTimezone)},
        interval '1 month'
      )::date AS month_start
    )
    SELECT
      to_char(m.month_start, 'YYYY-MM') AS month_key,
      COALESCE(COUNT(DISTINCT v.member_id)::int, 0) AS unique_members
    FROM months m
    LEFT JOIN visits v ON v.gym_id = ${gymId}::uuid
      AND (v.visited_at AT TIME ZONE ${gymTimezone})::date >= m.month_start
      AND (v.visited_at AT TIME ZONE ${gymTimezone})::date < (m.month_start + interval '1 month')::date
    GROUP BY m.month_start
    ORDER BY m.month_start ASC
  `)

  return rows.map((r) => ({
    label: toMonthLabel(r.month_key),
    value: Number(r.unique_members),
  }))
}
