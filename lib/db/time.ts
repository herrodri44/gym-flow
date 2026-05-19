import { sql } from 'drizzle-orm'

// Returns the start of the current month as a timestamptz in the given timezone.
// Equivalent to: (date_trunc('month', now() AT TIME ZONE tz) AT TIME ZONE tz)
export function monthStart(tz: string) {
  return sql`(date_trunc('month', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`
}

// Returns the start of the current month as a plain date in the given timezone.
// Equivalent to: date_trunc('month', now() AT TIME ZONE tz)::date
export function monthStartDate(tz: string) {
  return sql`date_trunc('month', now() AT TIME ZONE ${tz})::date`
}

// Returns the start of the current day as a timestamptz in the given timezone.
// Equivalent to: (date_trunc('day', now() AT TIME ZONE tz) AT TIME ZONE tz)
export function dayStart(tz: string) {
  return sql`(date_trunc('day', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`
}
