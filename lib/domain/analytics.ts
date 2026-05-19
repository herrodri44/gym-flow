import { db } from '@/lib/db/client'
import { gyms } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export interface DailyVisit {
  label: string  // 'DD/MM'
  value: number
}

// Row in the weekday × hour heatmap: 0=Sun…6=Sat, hour 0-23
export interface HeatmapCell {
  weekday: number  // 0 = Sunday, 6 = Saturday
  hour: number
  value: number
}

export interface PaymentTrendPoint {
  label: string   // 'MMM YY'
  collected: number
  pending: number
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function toMonthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-')
  return `${MONTHS_ES[Number(month) - 1]} ${year.slice(2)}`
}

export type AnalyticsData = {
  dailyVisits: DailyVisit[]
  heatmap: HeatmapCell[]
  paymentsTrend: PaymentTrendPoint[]
}

export async function getAnalyticsData(gymId: string): Promise<AnalyticsData> {
  const [gymRow] = await db
    .select({ timezone: gyms.timezone })
    .from(gyms)
    .where(eq(gyms.id, gymId))
    .limit(1)

  const gymTimezone = gymRow?.timezone ?? 'America/Argentina/Buenos_Aires'

  const [dailyVisits, heatmap, paymentsTrend] = await Promise.all([
    getDailyVisits(gymId, gymTimezone),
    getHeatmapData(gymId, gymTimezone),
    getPaymentsTrend(gymId),
  ])

  return { dailyVisits, heatmap, paymentsTrend }
}

// Visits per calendar day for the last 30 days (inclusive), in gym timezone
export async function getDailyVisits(gymId: string, gymTimezone: string): Promise<DailyVisit[]> {
  const rows = await db.execute<{ day: string; visits: number }>(sql`
    WITH days AS (
      SELECT generate_series(
        (now() AT TIME ZONE ${gymTimezone})::date - 29,
        (now() AT TIME ZONE ${gymTimezone})::date,
        interval '1 day'
      )::date AS day
    )
    SELECT
      to_char(d.day, 'DD/MM') AS day,
      COALESCE(COUNT(v.id)::int, 0) AS visits
    FROM days d
    LEFT JOIN visits v ON v.gym_id = ${gymId}::uuid
      AND (v.visited_at AT TIME ZONE ${gymTimezone})::date = d.day
    GROUP BY d.day
    ORDER BY d.day ASC
  `)

  return rows.map((r) => ({ label: r.day, value: Number(r.visits) }))
}

// Heatmap: visits aggregated by weekday (0=Sun) and hour-of-day in gym timezone
// Uses last 12 weeks of data for a representative sample
export async function getHeatmapData(gymId: string, gymTimezone: string): Promise<HeatmapCell[]> {
  const rows = await db.execute<{ weekday: number; hour: number; visits: number }>(sql`
    SELECT
      EXTRACT(DOW  FROM visited_at AT TIME ZONE ${gymTimezone})::int AS weekday,
      EXTRACT(HOUR FROM visited_at AT TIME ZONE ${gymTimezone})::int AS hour,
      COUNT(*)::int AS visits
    FROM visits
    WHERE gym_id = ${gymId}::uuid
      AND visited_at >= now() - interval '84 days'
    GROUP BY weekday, hour
    ORDER BY weekday, hour
  `)

  return rows.map((r) => ({
    weekday: Number(r.weekday),
    hour: Number(r.hour),
    value: Number(r.visits),
  }))
}

// Payments trend: collected vs pending per month for the last 12 months
export async function getPaymentsTrend(gymId: string): Promise<PaymentTrendPoint[]> {
  const rows = await db.execute<{ month_key: string; collected: string; pending: string }>(sql`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', now()) - interval '11 months',
        date_trunc('month', now()),
        interval '1 month'
      )::date AS month_start
    )
    SELECT
      to_char(m.month_start, 'YYYY-MM') AS month_key,
      COALESCE(SUM(pr.amount_ars) FILTER (WHERE pr.status = 'paid'), 0)::bigint            AS collected,
      COALESCE(SUM(pr.amount_ars) FILTER (WHERE pr.status IN ('pending', 'overdue')), 0)::bigint AS pending
    FROM months m
    LEFT JOIN payment_records pr ON pr.gym_id = ${gymId}::uuid
      AND pr.period_start >= m.month_start
      AND pr.period_start < (m.month_start + interval '1 month')::date
    GROUP BY m.month_start
    ORDER BY m.month_start ASC
  `)

  return rows.map((r) => ({
    label: toMonthLabel(r.month_key),
    collected: Number(r.collected),
    pending: Number(r.pending),
  }))
}
