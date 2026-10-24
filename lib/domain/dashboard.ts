import { db } from '@/lib/db/client'
import { gyms, gymSettings, members } from '@/lib/db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { monthStart } from '@/lib/db/time'
import { addDays } from './period-math'
import { RECENT_VISIT_DAYS, STALE_AFTER_DAYS } from './activity'

export interface KpiData {
  activeMembers: number
  inactiveMembers: number
  visitedLast7Days: number
  visitedThisMonth: number
  collectedThisMonth: number // centavos ARS, by payment date (gym-local month)
  upToDate: number // active members with a current period
  lapsed: number // active members whose period ended (grace + expired)
  noPlan: number // active members who never paid
  zeroCredits: number
  lowCredits: number
  lowCreditsThreshold: number
  /** Visits today by members in grace (period expired, not yet renewed) */
  graceVisitsToday: number
}

// A member the gym should contact. Members who already renewed early are excluded.
export interface FollowUpMember {
  id: string
  fullName: string
  planName: string | null
  /** Last valid day of the period */
  validUntil: string | null
  daysLeft: number | null
  daysSinceExpiry: number | null
  creditsLeft: number | null
  inGrace: boolean
  /** Gym-local date of the last visit */
  lastVisit: string | null
  daysSinceLastVisit: number | null
}

export interface FollowUpList {
  members: FollowUpMember[]
  /** Total matching members; `members` is capped at FOLLOW_UP_LIMIT */
  total: number
}

export interface FollowUpLists {
  /** Lapsed (grace or expired) and visited in the last RECENT_VISIT_DAYS: chase today. */
  lapsedComing: FollowUpList
  /** Lapsed and not seen for RECENT_VISIT_DAYS: offer a renewal or deactivate. */
  lapsedAway: FollowUpList
  expiringSoon: FollowUpList
  outOfCredits: FollowUpList
}

// Active members with no activity for STALE_AFTER_DAYS who aren't paying.
export interface StaleMember {
  id: string
  fullName: string
  status: 'expired' | 'no_plan'
  /** Latest of last visit and last valid day of the last period; join date if neither exists */
  lastActivity: string
}

export const EXPIRING_SOON_DAYS = 7
const FOLLOW_UP_LIMIT = 10

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

export async function getKpis(
  gymId: string,
  gymTimezone: string,
  lowCreditsThreshold: number,
): Promise<KpiData> {
  const [[standing], [visitStats], [collected]] = await Promise.all([
    db.execute<Record<string, number>>(sql`
      SELECT
        count(*) FILTER (WHERE member_active)::int                                        AS active_count,
        count(*) FILTER (WHERE NOT member_active)::int                                    AS inactive_count,
        count(*) FILTER (WHERE member_active AND status = 'active')::int                  AS up_to_date,
        count(*) FILTER (WHERE member_active AND status IN ('grace', 'expired'))::int     AS lapsed,
        count(*) FILTER (WHERE member_active AND status = 'no_plan')::int                 AS no_plan,
        count(*) FILTER (WHERE member_active AND status = 'active' AND plan_type = 'credits'
                           AND credits_left <= 0)::int                                    AS zero_credits,
        count(*) FILTER (WHERE member_active AND status = 'active' AND plan_type = 'credits'
                           AND credits_left > 0 AND credits_left <= ${lowCreditsThreshold})::int AS low_credits
      FROM member_standing
      WHERE gym_id = ${gymId}::uuid
    `),

    db.execute<{ visited_7d: number; visited_month: number; grace_today: number }>(sql`
      SELECT
        count(DISTINCT member_id) FILTER (
          WHERE visit_date > (now() AT TIME ZONE ${gymTimezone})::date - 7
        )::int AS visited_7d,
        count(DISTINCT member_id) FILTER (
          WHERE visit_date >= date_trunc('month', now() AT TIME ZONE ${gymTimezone})::date
        )::int AS visited_month,
        -- Grace visits have no period until the member pays (recordPayment attaches them).
        count(*) FILTER (
          WHERE visit_date = (now() AT TIME ZONE ${gymTimezone})::date AND period_id IS NULL
        )::int AS grace_today
      FROM visits
      WHERE gym_id = ${gymId}::uuid
        AND visit_date >= LEAST(
          (now() AT TIME ZONE ${gymTimezone})::date - 7,
          date_trunc('month', now() AT TIME ZONE ${gymTimezone})::date
        )
    `),

    db.execute<{ total: string }>(sql`
      SELECT COALESCE(sum(amount_ars), 0)::bigint AS total
      FROM payment_records
      WHERE gym_id = ${gymId}::uuid
        AND paid_at >= ${monthStart(gymTimezone)}
    `),
  ])

  return {
    activeMembers: Number(standing?.active_count ?? 0),
    inactiveMembers: Number(standing?.inactive_count ?? 0),
    visitedLast7Days: Number(visitStats?.visited_7d ?? 0),
    visitedThisMonth: Number(visitStats?.visited_month ?? 0),
    collectedThisMonth: Number(collected?.total ?? 0),
    upToDate: Number(standing?.up_to_date ?? 0),
    lapsed: Number(standing?.lapsed ?? 0),
    noPlan: Number(standing?.no_plan ?? 0),
    zeroCredits: Number(standing?.zero_credits ?? 0),
    lowCredits: Number(standing?.low_credits ?? 0),
    lowCreditsThreshold,
    graceVisitsToday: Number(visitStats?.grace_today ?? 0),
  }
}

type FollowUpRow = {
  id: string
  full_name: string
  plan_name: string | null
  end_date: string | null
  days_left: number | null
  days_since_expiry: number | null
  credits_left: number | null
  status: string
  last_visit: string | null
  days_since_last_visit: number | null
  total: number
}

const toNum = (v: number | null) => (v === null ? null : Number(v))

function toFollowUp(r: FollowUpRow): FollowUpMember {
  return {
    id: r.id,
    fullName: r.full_name,
    planName: r.plan_name,
    validUntil: r.end_date ? addDays(r.end_date, -1) : null,
    daysLeft: toNum(r.days_left),
    daysSinceExpiry: toNum(r.days_since_expiry),
    creditsLeft: toNum(r.credits_left),
    inGrace: r.status === 'grace',
    lastVisit: r.last_visit,
    daysSinceLastVisit: toNum(r.days_since_last_visit),
  }
}

function toList(rows: FollowUpRow[]): FollowUpList {
  return { members: rows.map(toFollowUp), total: Number(rows[0]?.total ?? 0) }
}

export async function getFollowUpLists(gymId: string): Promise<FollowUpLists> {
  const followUp = (where: ReturnType<typeof sql>, orderBy: ReturnType<typeof sql>) =>
    db.execute<FollowUpRow>(sql`
      SELECT m.id, m.full_name, s.plan_name, s.end_date::text AS end_date, s.days_left,
             s.days_since_expiry, s.credits_left, s.status,
             lv.last_visit::text AS last_visit,
             s.today - lv.last_visit AS days_since_last_visit,
             count(*) OVER ()::int AS total
      FROM member_standing s
      JOIN members m ON m.id = s.member_id
      LEFT JOIN LATERAL (
        SELECT max(v.visit_date) AS last_visit FROM visits v WHERE v.member_id = m.id
      ) lv ON true
      WHERE s.gym_id = ${gymId}::uuid
        AND s.member_active
        AND NOT s.has_upcoming
        AND ${where}
      ORDER BY ${orderBy}
      LIMIT ${FOLLOW_UP_LIMIT}
    `)

  const recent = sql`lv.last_visit > s.today - ${RECENT_VISIT_DAYS}::int`
  const lapsed = sql`s.status IN ('grace', 'expired')`

  const [lapsedComing, lapsedAway, expiringSoon, outOfCredits] = await Promise.all([
    followUp(sql`${lapsed} AND ${recent}`, sql`lv.last_visit DESC, m.full_name`),
    followUp(sql`${lapsed} AND (lv.last_visit IS NULL OR NOT ${recent})`, sql`s.end_date DESC, m.full_name`),
    followUp(sql`s.status = 'active' AND s.days_left <= ${EXPIRING_SOON_DAYS}`, sql`s.days_left, m.full_name`),
    followUp(
      sql`s.status = 'active' AND s.plan_type = 'credits' AND s.credits_left <= 0`,
      sql`s.end_date, m.full_name`,
    ),
  ])

  return {
    lapsedComing: toList(lapsedComing),
    lapsedAway: toList(lapsedAway),
    expiringSoon: toList(expiringSoon),
    outOfCredits: toList(outOfCredits),
  }
}

// Members still marked active who neither pay nor come: expired (past grace)
// or never paid, with no visit, period or sign-up in the last STALE_AFTER_DAYS.
// Members in grace or with a current/upcoming period are never included.
export async function getStaleMembers(gymId: string): Promise<StaleMember[]> {
  const rows = await db.execute<{ id: string; full_name: string; status: 'expired' | 'no_plan'; last_activity: string }>(sql`
    SELECT id, full_name, status, last_activity::text AS last_activity
    FROM (
      SELECT m.id, m.full_name, s.status, s.today,
             COALESCE(GREATEST(lv.last_visit, s.end_date - 1), m.joined_at, m.created_at::date) AS last_activity
      FROM member_standing s
      JOIN members m ON m.id = s.member_id
      LEFT JOIN LATERAL (
        SELECT max(v.visit_date) AS last_visit FROM visits v WHERE v.member_id = m.id
      ) lv ON true
      WHERE s.gym_id = ${gymId}::uuid
        AND s.member_active
        AND s.status IN ('expired', 'no_plan')
        AND NOT s.has_upcoming
    ) t
    WHERE last_activity <= today - ${STALE_AFTER_DAYS}::int
    ORDER BY last_activity, full_name
  `)

  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    status: r.status,
    lastActivity: r.last_activity,
  }))
}

// Marks the given members inactive. Scoped to the gym, so ids from another
// gym are ignored. Returns how many were changed.
export async function deactivateMembers(gymId: string, memberIds: string[]): Promise<number> {
  if (memberIds.length === 0) return 0
  const updated = await db
    .update(members)
    .set({ active: false })
    .where(and(eq(members.gymId, gymId), inArray(members.id, memberIds), eq(members.active, true)))
    .returning({ id: members.id })
  return updated.length
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
