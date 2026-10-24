// Pure date math for payment-anchored membership periods (PLAN.md §2, B1–B4).
// Member status (active / grace / expired) is computed by the `member_standing`
// SQL view, not here.
//
// All dates are gym-local calendar dates as 'YYYY-MM-DD' strings. Callers get
// "today" from the DB in the gym's timezone (see lib/db/time.ts) and never
// build business dates with JS Date, which runs in UTC on Vercel.
//
// Periods are half-open: [startDate, endDate). A period paid on Oct 5 has
// endDate Nov 5 — valid through Nov 4, renewal due Nov 5.

export type LocalDate = string

export type PeriodDates = {
  startDate: LocalDate
  endDate: LocalDate
  /** Day of month the period renews on; kept across contiguous renewals (B4). */
  anchorDay: number
}

export type CalculateNextPeriodInput = {
  lastPeriod: { endDate: LocalDate; anchorDay: number } | null
  paymentDate: LocalDate
  /** Admin-edited start date (B2). */
  startOverride?: LocalDate
}

export type CalculateNextPeriodResult =
  | PeriodDates
  | { error: 'invalid_date' | 'overlaps_previous_period' }

export function calculateNextPeriod({
  lastPeriod,
  paymentDate,
  startOverride,
}: CalculateNextPeriodInput): CalculateNextPeriodResult {
  if (!isValidDate(paymentDate)) return { error: 'invalid_date' }
  if (startOverride !== undefined && !isValidDate(startOverride)) return { error: 'invalid_date' }

  let startDate: LocalDate
  let anchorDay: number

  if (startOverride !== undefined) {
    if (lastPeriod && startOverride < lastPeriod.endDate) {
      return { error: 'overlaps_previous_period' }
    }
    startDate = startOverride
    // Starting exactly where the last period ended is a contiguous renewal.
    anchorDay =
      lastPeriod && startOverride === lastPeriod.endDate ? lastPeriod.anchorDay : dayOf(startOverride)
  } else if (lastPeriod && paymentDate <= lastPeriod.endDate) {
    // Early or on-time renewal (B3): queue after the current period.
    startDate = lastPeriod.endDate
    anchorDay = lastPeriod.anchorDay
  } else {
    // First payment or late renewal (B2): start on the payment date.
    startDate = paymentDate
    anchorDay = dayOf(paymentDate)
  }

  return { startDate, endDate: nextAnchorDate(startDate, anchorDay), anchorDay }
}

// Shift a local date by n calendar days (negative allowed). The last valid
// day of a period is addDays(endDate, -1).
export function addDays(date: LocalDate, n: number): LocalDate {
  const d = new Date(toUtcMs(date) + n * 86_400_000)
  return format(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// The anchor day in the month after `date`, clamped to that month's length.
function nextAnchorDate(date: LocalDate, anchorDay: number): LocalDate {
  const [y, m] = parts(date)
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  return format(nextY, nextM, Math.min(anchorDay, daysInMonth(nextY, nextM)))
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = parts(value)
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)
}

function parts(date: LocalDate): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

function dayOf(date: LocalDate): number {
  return parts(date)[2]
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function toUtcMs(date: LocalDate): number {
  const [y, m, d] = parts(date)
  return Date.UTC(y, m - 1, d)
}

function format(y: number, m: number, d: number): LocalDate {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
