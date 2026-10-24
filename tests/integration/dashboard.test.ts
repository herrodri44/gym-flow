// Dashboard follow-up lists, stale-member cleanup and the members-list
// attendance filters, against a real Postgres (member_standing + visits).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { createMember, createTestGym, db, deleteTestGym, gymToday, insertVisitOn, type TestGym } from './helpers'
import { recordPayment } from '@/lib/domain/payments'
import { deactivateMembers, getFollowUpLists, getKpis, getStaleMembers } from '@/lib/domain/dashboard'
import { getMembersList, type MembersListFilters } from '@/lib/domain/members-list'
import { addDays } from '@/lib/domain/period-math'

let gym: TestGym
let graceGym: TestGym
let other: TestGym
let today: string

// Members of `gym`, set up once and shared by the read tests.
const m = {} as Record<
  'coming' | 'away' | 'neverCame' | 'stale' | 'staleNoPlan' | 'freshNoPlan' | 'current' | 'inactive',
  { id: string }
>

const pay = (g: TestGym, memberId: string, paymentDate: string) =>
  recordPayment({ gymId: g.gymId, memberId, planId: g.plans.credits12, amountArs: 3_000_000, paymentDate })

const setJoined = (memberId: string, date: string) =>
  db.execute(sql`UPDATE members SET joined_at = ${date}::date WHERE id = ${memberId}::uuid`)

beforeAll(async () => {
  gym = await createTestGym()
  graceGym = await createTestGym({ graceDays: 45 })
  other = await createTestGym()
  today = await gymToday()

  // Expired ~10 days ago, came 3 days ago.
  m.coming = await createMember(gym.gymId, 'Viene')
  await pay(gym, m.coming.id, addDays(today, -41))
  await insertVisitOn(gym.gymId, m.coming.id, addDays(today, -3))

  // Expired ~10 days ago, last visit 40 days ago (inside the old period).
  m.away = await createMember(gym.gymId, 'No viene')
  await pay(gym, m.away.id, addDays(today, -41))
  await insertVisitOn(gym.gymId, m.away.id, addDays(today, -40))

  // Expired, never visited.
  m.neverCame = await createMember(gym.gymId, 'Nunca vino')
  await pay(gym, m.neverCame.id, addDays(today, -41))

  // Expired long ago, last visit 90 days ago.
  m.stale = await createMember(gym.gymId, 'Abandonó')
  await pay(gym, m.stale.id, addDays(today, -150))
  await insertVisitOn(gym.gymId, m.stale.id, addDays(today, -90))

  // Never paid, joined 100 days ago / 10 days ago.
  m.staleNoPlan = await createMember(gym.gymId, 'Sin plan viejo')
  await setJoined(m.staleNoPlan.id, addDays(today, -100))
  m.freshNoPlan = await createMember(gym.gymId, 'Sin plan nuevo')
  await setJoined(m.freshNoPlan.id, addDays(today, -10))

  // Paid today: active.
  m.current = await createMember(gym.gymId, 'Al día')
  await pay(gym, m.current.id, today)

  // Would be stale, but already inactive.
  m.inactive = await createMember(gym.gymId, 'Inactivo')
  await pay(gym, m.inactive.id, addDays(today, -150))
  await db.execute(sql`UPDATE members SET active = false WHERE id = ${m.inactive.id}::uuid`)
})

afterAll(async () => {
  await deleteTestGym(gym)
  await deleteTestGym(graceGym)
  await deleteTestGym(other)
})

const ids = (list: { members: { id: string }[] }) => list.members.map((x) => x.id).sort()

describe('getFollowUpLists', () => {
  it('splits lapsed members by whether they visited in the last 30 days', async () => {
    const lists = await getFollowUpLists(gym.gymId)

    expect(ids(lists.lapsedComing)).toEqual([m.coming.id])
    expect(lists.lapsedComing.total).toBe(1)
    expect(lists.lapsedComing.members[0]).toMatchObject({ daysSinceLastVisit: 3, lastVisit: addDays(today, -3) })

    expect(ids(lists.lapsedAway)).toEqual([m.away.id, m.neverCame.id, m.stale.id].sort())
    const neverCame = lists.lapsedAway.members.find((x) => x.id === m.neverCame.id)
    expect(neverCame).toMatchObject({ lastVisit: null, daysSinceLastVisit: null })
  })

  it('does not list active, never-paid or inactive members as lapsed', async () => {
    const lists = await getFollowUpLists(gym.gymId)
    const lapsed = [...ids(lists.lapsedComing), ...ids(lists.lapsedAway)]
    for (const id of [m.current.id, m.staleNoPlan.id, m.freshNoPlan.id, m.inactive.id]) {
      expect(lapsed).not.toContain(id)
    }
  })
})

describe('getStaleMembers', () => {
  it('lists expired and never-paid members with no activity for 60+ days', async () => {
    const stale = await getStaleMembers(gym.gymId)
    expect(stale.map((x) => x.id).sort()).toEqual([m.stale.id, m.staleNoPlan.id].sort())
    expect(stale.find((x) => x.id === m.stale.id)).toMatchObject({
      status: 'expired',
      lastActivity: addDays(today, -90),
    })
    expect(stale.find((x) => x.id === m.staleNoPlan.id)).toMatchObject({
      status: 'no_plan',
      lastActivity: addDays(today, -100),
    })
  })

  it('never includes members in grace', async () => {
    const member = await createMember(graceGym.gymId)
    await pay(graceGym, member.id, addDays(today, -70)) // ended ~40 days ago, grace is 45
    await setJoined(member.id, addDays(today, -200))
    expect(await getStaleMembers(graceGym.gymId)).toEqual([])
  })
})

describe('getKpis.graceVisitsToday', () => {
  it('counts today’s visits that have no period (grace check-ins)', async () => {
    const member = await createMember(graceGym.gymId)
    await pay(graceGym, member.id, addDays(today, -40))
    await insertVisitOn(graceGym.gymId, member.id, today)

    const kpis = await getKpis(graceGym.gymId, 'America/Argentina/Buenos_Aires', 2)
    expect(kpis.graceVisitsToday).toBe(1)
  })
})

describe('getMembersList filters', () => {
  const base: MembersListFilters = { q: '', status: 'active', payment: 'all', seen: 'all', page: 1 }
  const list = async (f: Partial<MembersListFilters>) =>
    (await getMembersList(gym.gymId, { ...base, ...f })).rows.map((r) => r.id).sort()

  it("'lapsed' matches the dashboard: grace or expired", async () => {
    expect(await list({ payment: 'lapsed' })).toEqual([m.coming.id, m.away.id, m.neverCame.id, m.stale.id].sort())
  })

  it('splits lapsed members by attendance like the dashboard lists', async () => {
    const lists = await getFollowUpLists(gym.gymId)
    expect(await list({ payment: 'lapsed', seen: 'recent' })).toEqual(ids(lists.lapsedComing))
    expect(await list({ payment: 'lapsed', seen: 'away' })).toEqual(ids(lists.lapsedAway))
  })
})

describe('deactivateMembers', () => {
  it('deactivates only the given members of this gym', async () => {
    const mine = await createMember(gym.gymId)
    const theirs = await createMember(other.gymId)

    expect(await deactivateMembers(gym.gymId, [mine.id, theirs.id])).toBe(1)

    const rows = await db.execute<{ id: string; active: boolean }>(sql`
      SELECT id, active FROM members WHERE id IN (${mine.id}::uuid, ${theirs.id}::uuid)`)
    expect(Object.fromEntries(rows.map((r) => [r.id, r.active]))).toEqual({ [mine.id]: false, [theirs.id]: true })
  })

  it('returns 0 for an empty selection', async () => {
    expect(await deactivateMembers(gym.gymId, [])).toBe(0)
  })
})
