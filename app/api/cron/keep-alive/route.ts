import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { logger } from '@/lib/logger'

// Daily ping so the Supabase free plan doesn't pause the project for
// inactivity. The request also passes through proxy.ts, which calls
// Supabase Auth, so both Postgres and Auth see traffic.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await db.execute(sql`SELECT 1`)
    logger.info('cron.keep_alive', { outcome: 'ok' })
    return Response.json({ ok: true })
  } catch (error) {
    logger.error(error instanceof Error ? error : String(error), { event: 'cron.keep_alive' })
    return Response.json({ error: 'Database unreachable' }, { status: 500 })
  }
}
