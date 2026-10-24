// Rebuilds the LOCAL Supabase database from lib/db/migrations and seeds it.
//
//   supabase start            # once per session (Docker)
//   npm run db:local:reset    # wipe + migrate + seed
//
// The seed is written in the pre-0006 (calendar-month) shape, so the reset
// applies migrations up to LEGACY_SEED_BEFORE, seeds, then applies the rest.
// Every reset therefore rehearses the billing cutover on realistic data.
//
// Reads .env.development.local and refuses to touch anything that isn't
// 127.0.0.1 / localhost.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)

const isLocal = (url) => /\/\/([^@/]*@)?(127\.0\.0\.1|localhost)[:/]/.test(url ?? '')
if (!isLocal(env.DATABASE_URL) || !isLocal(env.NEXT_PUBLIC_SUPABASE_URL)) {
  console.error('Refusing to run: DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL are not local.')
  process.exit(1)
}

const sql = postgres(env.DATABASE_URL, { ssl: false, onnotice: () => {} })

const TZ = 'America/Argentina/Buenos_Aires'
const LEGACY_SEED_BEFORE = '0006'
// --legacy stops before the cutover migration (for `npm run db:cutover-dry-run`).
const legacyOnly = process.argv.includes('--legacy')
const MIGRATIONS_DIR = 'lib/db/migrations'
const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()

async function applyMigrations(files) {
  for (const file of files) {
    await sql.unsafe(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
    console.log(`  applied ${file}`)
  }
}

async function reset() {
  await sql.unsafe(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
    DELETE FROM auth.users;
  `)
  await applyMigrations(migrationFiles.filter((f) => f < LEGACY_SEED_BEFORE))
}

async function createUser(email, password, role, fullName) {
  // Auth admin REST API directly: supabase-js needs a native WebSocket (Node 22+).
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { full_name: fullName },
    }),
  })
  if (!res.ok) throw new Error(`createUser ${email}: ${res.status} ${await res.text()}`)
  const user = await res.json()
  await sql`INSERT INTO profiles (id, role, full_name, email) VALUES (${user.id}, ${role}, ${fullName}, ${email})`
  return user.id
}

// [name, dni, plan, active, payment status per month: [2 months ago, last month, this month], email?]
// Payment rows mimic the current system: one row per calendar month per enrolled member.
const MEMBERS = [
  ['Ana García', '30000001', '12 clases', true, ['paid', 'paid', 'paid']],
  ['Bruno Pérez', '30000002', '8 clases', true, ['paid', 'paid', 'pending']],
  ['Carla Gómez', '30000003', 'Libre', true, ['paid', 'paid', 'paid']],
  ['Diego Fernández', '30000004', '12 clases', true, ['paid', 'overdue', 'pending']],
  ['Elena Romero', '30000005', '8 clases', true, ['paid', 'paid', 'paid'], 'elena@gymdex.local'],
  ['Facundo Díaz', '30000006', '12 clases', true, ['paid', 'overdue', 'pending']],
  ['Gabriela Torres', '30000007', null, true, null],
  ['Hernán Ruiz', '30000008', '8 clases', false, ['paid', null, null]],
  ['Ignacio Sosa', '30000009', '12 clases', true, ['paid', 'paid', 'paid']],
  ['Julieta Álvarez', '30000010', 'Libre', true, ['paid', 'paid', 'pending']],
]

async function seed() {
  const superId = await createUser('super@gymdex.local', 'super1234', 'superadmin', 'Super Admin')
  const adminId = await createUser('admin@gymdex.local', 'admin1234', 'gym_admin', 'Laura Admin')
  await sql`UPDATE profiles SET terms_accepted_at = now() WHERE id = ${adminId}`

  const [gym] = await sql`
    INSERT INTO gyms (name, slug, timezone, address, phone)
    VALUES ('Gym Demo', 'gym-demo', ${TZ}, 'Av. Siempre Viva 742', '11 5555-0000')
    RETURNING id`
  await sql`INSERT INTO gym_settings (gym_id) VALUES (${gym.id})`
  await sql`INSERT INTO gym_admins (gym_id, user_id) VALUES (${gym.id}, ${adminId})`

  const plans = {}
  for (const [name, type, price, credits] of [
    ['8 clases', 'credits', 2_500_000, 8],
    ['12 clases', 'credits', 3_000_000, 12],
    ['Libre', 'unlimited', 4_500_000, null],
  ]) {
    const [row] = await sql`
      INSERT INTO membership_plans (gym_id, name, plan_type, price_ars, credits_per_month)
      VALUES (${gym.id}, ${name}, ${type}, ${price}, ${credits})
      RETURNING id, price_ars`
    plans[name] = row
  }

  const monthStart = (k) =>
    sql`(date_trunc('month', now() AT TIME ZONE ${TZ}) - make_interval(months => ${k})) AT TIME ZONE ${TZ}`

  for (const [i, [fullName, dni, planName, active, payments, email]] of MEMBERS.entries()) {
    const userId = email ? await createUser(email, dni, 'member', fullName) : null
    const [member] = await sql`
      INSERT INTO members (gym_id, document_number, full_name, phone, email, joined_at, user_id, active)
      VALUES (${gym.id}, ${dni}, ${fullName}, ${'11 4000-00' + String(i).padStart(2, '0')}, ${email ?? null},
              (now() AT TIME ZONE ${TZ})::date - 100, ${userId}, ${active})
      RETURNING id`

    if (!planName) continue
    const plan = plans[planName]
    const [enrollment] = await sql`
      INSERT INTO enrollments (gym_id, member_id, plan_id, started_at, active)
      VALUES (${gym.id}, ${member.id}, ${plan.id}, ${monthStart(2)}, ${active})
      RETURNING id`

    // Payments: months 2, 1, 0 ago. Paid ones land a few days into the month.
    for (const [idx, status] of payments.entries()) {
      if (!status) continue
      const k = 2 - idx
      const offsetDays = (i * 3 + k * 5) % 12
      await sql`
        INSERT INTO payment_records
          (gym_id, member_id, enrollment_id, amount_ars, period_start, period_end, status, paid_at)
        VALUES (
          ${gym.id}, ${member.id}, ${enrollment.id}, ${plan.price_ars},
          ${monthStart(k)},
          ${monthStart(k - 1)} - interval '1 second',
          ${status},
          ${status === 'paid' ? sql`least(${monthStart(k)} + make_interval(days => ${offsetDays}), now())` : null}
        )`
    }

    // Visits over the last 75 days, at most one per day, ~3 per week
    // (Ignacio comes almost every day to exhaust his credits).
    if (active) {
      const keepEvery = dni === '30000009' ? 1 : 2
      await sql`
        INSERT INTO visits (gym_id, member_id, visited_at, channel, recorded_by)
        SELECT ${gym.id}, ${member.id},
               (d + time '18:30') AT TIME ZONE ${TZ},
               (CASE WHEN extract(dow FROM d)::int % 2 = 0 THEN 'fichaje_public' ELSE 'fichaje_admin' END)::visit_channel,
               ${adminId}
        FROM generate_series((now() AT TIME ZONE ${TZ})::date - 75, (now() AT TIME ZONE ${TZ})::date - 1, interval '1 day') AS g(d)
        WHERE extract(dow FROM d) <> 0
          AND (extract(doy FROM d)::int + ${i}) % ${keepEvery + 1} = 0`
    }
  }

  const [ana] = await sql`SELECT id FROM members WHERE document_number = '30000001'`
  await sql`
    INSERT INTO credit_adjustments (gym_id, member_id, amount, date, recorded_by, notes)
    VALUES (${gym.id}, ${ana.id}, 1, (now() AT TIME ZONE ${TZ})::date - 3, ${adminId}, 'Entró sin fichar')`

  void superId
}

try {
  console.log('Resetting local database…')
  await reset()
  console.log('Seeding (legacy shape)…')
  await seed()
  if (legacyOnly) {
    console.log(`Stopped before ${LEGACY_SEED_BEFORE} (--legacy).`)
  } else {
    console.log('Applying remaining migrations (cutover)…')
    await applyMigrations(migrationFiles.filter((f) => f >= LEGACY_SEED_BEFORE))
  }
  const [counts] = await sql`
    SELECT (SELECT count(*) FROM members) AS members, (SELECT count(*) FROM visits) AS visits,
           (SELECT count(*) FROM payment_records) AS payments`
  console.log(`Done: ${counts.members} members, ${counts.visits} visits, ${counts.payments} payments.`)
  console.log(`
  Logins (http://localhost:3000/login):
    superadmin   super@gymdex.local / super1234
    gym admin    admin@gymdex.local / admin1234
    member       elena@gymdex.local / 30000005
  Kiosk: http://localhost:3000/g/gym-demo   Studio: http://127.0.0.1:54323`)
} finally {
  await sql.end()
}
