import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { logger } from '@/lib/logger'

// Daily ping so the Supabase free plan doesn't pause the project for
// inactivity. A bare SELECT 1 through the pooler ran every day and the
// project was still flagged (2026-10-30), so this also calls the REST and
// Auth APIs with the anon key: that's the API traffic Supabase sees.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` }

  try {
    await db.execute(sql`SELECT 1`)
    // Any response counts as traffic; RLS may hide every row from anon.
    const [rest, auth] = await Promise.all([
      fetch(`${url}/rest/v1/gyms?select=id&limit=1`, { headers, cache: 'no-store' }),
      fetch(`${url}/auth/v1/health`, { headers, cache: 'no-store' }),
    ])
    logger.info('cron.keep_alive', { outcome: 'ok', rest: rest.status, auth: auth.status })
    return Response.json({ ok: true, rest: rest.status, auth: auth.status })
  } catch (error) {
    logger.error(error instanceof Error ? error : String(error), { event: 'cron.keep_alive' })
    return Response.json({ error: 'Supabase unreachable' }, { status: 500 })
  }
}
