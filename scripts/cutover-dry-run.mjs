// Billing cutover dry run: executes migration 0006 inside a transaction,
// prints what it did, then ROLLS BACK. Nothing is persisted.
//
//   npm run db:local:reset -- --legacy   # local DB in the pre-0006 shape
//   npm run db:cutover-dry-run           # against the local DB
//   npm run db:cutover-dry-run -- --prod # against DATABASE_URL_DIRECT in .env.local (read-only: rolled back)
//   add `--grace 14` to preview statuses with that grace_days applied after the migration

import { readFileSync } from 'node:fs'
import postgres from 'postgres'

const prod = process.argv.includes('--prod')
const graceArg = process.argv.indexOf('--grace')
const grace = graceArg === -1 ? null : Number(process.argv[graceArg + 1])
const envFile = prod ? '.env.local' : '.env.development.local'
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
)
const url = prod ? env.DATABASE_URL_DIRECT : env.DATABASE_URL
const isLocal = /\/\/([^@/]*@)?(127\.0\.0\.1|localhost)[:/]/.test(url ?? '')
if (!prod && !isLocal) {
  console.error('Refusing: local mode but DATABASE_URL is not local. Use --prod explicitly.')
  process.exit(1)
}

const sql = postgres(url, { ssl: isLocal ? false : 'require', max: 1, onnotice: () => {} })
const migration = readFileSync('lib/db/migrations/0006_membership_periods.sql', 'utf8')

class Rollback extends Error {}

const fmt = (d) => d ?? "—"

try {
  const [{ exists }] = await sql`SELECT to_regclass('public.membership_periods') IS NOT NULL AS exists`
  if (exists) {
    console.error('membership_periods already exists — this database is already migrated.')
    process.exit(1)
  }

  await sql.begin(async (tx) => {
    const [before] = await tx`
      SELECT
        (SELECT count(*) FROM payment_records WHERE status IN ('pending', 'overdue'))::int AS unpaid_rows,
        (SELECT count(*) FROM payment_records WHERE status = 'paid')::int AS paid_rows,
        (SELECT count(*) FROM (
           SELECT 1 FROM visits v JOIN gyms g ON g.id = v.gym_id
           GROUP BY v.member_id, (v.visited_at AT TIME ZONE g.timezone)::date
           HAVING count(*) > 1) d)::int AS duplicate_visit_days`

    await tx.unsafe(migration)
    if (grace !== null) await tx`UPDATE gym_settings SET grace_days = ${grace}`

    const [after] = await tx`SELECT count(*)::int AS periods FROM membership_periods`
    const orphanPayments = await tx`
      SELECT m.full_name, pr.amount_ars, (pr.paid_at AT TIME ZONE g.timezone)::date::text AS paid_at
      FROM payment_records pr
      JOIN members m ON m.id = pr.member_id
      JOIN gyms g ON g.id = pr.gym_id
      LEFT JOIN membership_periods p ON p.payment_id = pr.id
      WHERE p.id IS NULL
      ORDER BY m.full_name`
    const standing = await tx`
      SELECT g.name AS gym, m.full_name, m.document_number, s.status, s.plan_name,
             s.end_date::text AS end_date, s.credits_left, s.has_upcoming
      FROM member_standing s
      JOIN members m ON m.id = s.member_id
      JOIN gyms g ON g.id = s.gym_id
      WHERE s.member_active
      ORDER BY g.name, s.status, m.full_name`

    console.log(`\n=== Billing cutover dry run (${prod ? 'PRODUCTION' : 'local'}) — nothing will be saved ===\n`)
    console.log(`Paid payments converted:       ${before.paid_rows} → ${after.periods} periods`)
    console.log(`Pending/overdue rows deleted:  ${before.unpaid_rows}`)
    console.log(`Duplicate same-day visits:     ${before.duplicate_visit_days} member-days (later duplicates deleted)`)

    if (orphanPayments.length) {
      console.log(`\nPaid payments with no plan to attach (kept in the ledger, no period created):`)
      for (const p of orphanPayments) console.log(`  - ${p.full_name}  ${p.amount_ars / 100} ARS  paid ${fmt(p.paid_at)}`)
    }

    const counts = standing.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
    console.log(`\nActive members by status after cutover${grace !== null ? ` (grace_days = ${grace})` : ''}:`, counts)

    const blocked = standing.filter((r) => r.status !== 'active' && r.status !== 'grace')
    if (blocked.length) {
      console.log(`\n⚠ Active members WITHOUT a current period (blocked at check-in):`)
      for (const r of blocked) {
        const detail = r.status === 'no_plan' ? 'never paid' : `last period ended ${fmt(r.end_date)} (${r.plan_name})`
        console.log(`  - [${r.gym}] ${r.full_name} (DNI ${r.document_number}): ${r.status}, ${detail}`)
      }
    }

    const queued = standing.filter((r) => r.has_upcoming)
    if (queued.length) {
      console.log(`\nMembers with an early renewal queued after the current period: ${queued.map((r) => r.full_name).join(', ')}`)
    }

    throw new Rollback()
  })
} catch (e) {
  if (!(e instanceof Rollback)) throw e
  console.log('\nRolled back. No changes were made.')
} finally {
  await sql.end()
}
