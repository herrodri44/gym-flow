// Payment-anchored billing against a real Postgres: recordPayment, the
// member_standing view, check-in decisions and the one-visit-per-day guard.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  createMember,
  createTestGym,
  db,
  deleteTestGym,
  gymToday,
  insertVisitOn,
  periodsOf,
  type TestGym,
} from './helpers'
import { recordPayment, deletePayment } from '@/lib/domain/payments'
import { getMemberStanding } from '@/lib/domain/standing'
import { evaluateMemberFichaje, recordVisit } from '@/lib/domain/fichaje'
import { addDays, calculateNextPeriod, type PeriodDates } from '@/lib/domain/period-math'

let gym: TestGym
let other: TestGym
let today: string

beforeAll(async () => {
  gym = await createTestGym()
  other = await createTestGym()
  today = await gymToday()
})

afterAll(async () => {
  await deleteTestGym(gym)
  await deleteTestGym(other)
})

const pay = (memberId: string, extra: Partial<Parameters<typeof recordPayment>[0]> = {}, g = gym) =>
  recordPayment({ gymId: g.gymId, memberId, planId: g.plans.credits12, amountArs: 3_000_000, ...extra })

function expectedFirst(paymentDate: string): PeriodDates {
  const p = calculateNextPeriod({ lastPeriod: null, paymentDate })
  if ('error' in p) throw new Error(p.error)
  return p
}

describe('recordPayment', () => {
  it('first payment today creates an active period with the plan credits', async () => {
    const m = await createMember(gym.gymId)
    const result = await pay(m.id)
    expect(result).toEqual({ success: true, period: expectedFirst(today) })

    const s = await getMemberStanding(m.id, gym.gymId)
    expect(s).toMatchObject({ status: 'active', creditsLeft: 12, startDate: today, hasUpcoming: false })
  })

  it('early renewal is queued after the current period; standing stays on the current one', async () => {
    const m = await createMember(gym.gymId)
    await pay(m.id)
    const second = await pay(m.id)
    const first = expectedFirst(today)
    expect(second).toMatchObject({ success: true, period: { startDate: first.endDate, anchorDay: first.anchorDay } })

    const s = await getMemberStanding(m.id, gym.gymId)
    expect(s).toMatchObject({ status: 'active', startDate: today, hasUpcoming: true })
  })

  it('late renewal starts on the payment date', async () => {
    const m = await createMember(gym.gymId)
    const oldDate = addDays(today, -45)
    await pay(m.id, { paymentDate: oldDate })
    expect((await getMemberStanding(m.id, gym.gymId))?.status).toBe('expired')

    const renewed = await pay(m.id)
    expect(renewed).toMatchObject({ success: true, period: { startDate: today } })
    expect((await getMemberStanding(m.id, gym.gymId))?.status).toBe('active')
  })

  it('accepts a backdated payment date and a start override', async () => {
    const m = await createMember(gym.gymId)
    const result = await pay(m.id, { paymentDate: addDays(today, -3), startDate: addDays(today, -5) })
    expect(result).toMatchObject({ success: true, period: { startDate: addDays(today, -5) } })
  })

  it('rejects a start override that overlaps the current period', async () => {
    const m = await createMember(gym.gymId)
    await pay(m.id)
    const result = await pay(m.id, { startDate: addDays(today, 1) })
    expect(result).toHaveProperty('error')
    expect(await periodsOf(m.id)).toHaveLength(1)
  })

  it('rejects a future payment date', async () => {
    const m = await createMember(gym.gymId)
    expect(await pay(m.id, { paymentDate: addDays(today, 1) })).toEqual({
      error: 'La fecha de pago no puede ser futura',
    })
  })

  it('rejects archived plans, other gyms\' plans and other gyms\' members', async () => {
    const m = await createMember(gym.gymId)
    expect(await pay(m.id, { planId: gym.plans.archived })).toEqual({ error: 'El plan está archivado' })
    expect(await pay(m.id, { planId: other.plans.credits12 })).toEqual({ error: 'Plan no encontrado' })

    const foreign = await createMember(other.gymId)
    expect(await pay(foreign.id)).toEqual({ error: 'Socio no encontrado' })
    expect(await periodsOf(foreign.id)).toHaveLength(0)
  })

  it('attaches visits inside a backdated period', async () => {
    const m = await createMember(gym.gymId)
    await insertVisitOn(gym.gymId, m.id, addDays(today, -2))
    await pay(m.id, { paymentDate: addDays(today, -4) })
    const s = await getMemberStanding(m.id, gym.gymId)
    expect(s).toMatchObject({ creditsUsed: 1, creditsLeft: 11 })
  })

  it('does not attach old unpaid-history visits to a new first period', async () => {
    const m = await createMember(gym.gymId)
    await insertVisitOn(gym.gymId, m.id, addDays(today, -60))
    await pay(m.id)
    expect((await getMemberStanding(m.id, gym.gymId))?.creditsUsed).toBe(0)
  })
})

describe('grace period (B5)', () => {
  let graceGym: TestGym
  beforeAll(async () => {
    graceGym = await createTestGym({ graceDays: 3 })
  })
  afterAll(async () => deleteTestGym(graceGym))

  it('allows check-in during grace and counts the visit against the next period', async () => {
    const m = await createMember(graceGym.gymId)
    // A period that ended yesterday.
    const start = addDays(today, -40)
    await pay(m.id, { paymentDate: start, startDate: start }, graceGym)
    await db.execute(sql`UPDATE membership_periods SET end_date = ${today}::date - 1 WHERE member_id = ${m.id}::uuid`)

    expect(await getMemberStanding(m.id, graceGym.gymId)).toMatchObject({ status: 'grace', daysSinceExpiry: 1 })

    const decision = await evaluateMemberFichaje(m, graceGym.gymId)
    expect(decision.result).toMatchObject({ status: 'grace_allowed', graceDaysLeft: 2 })
    expect(decision.visit).toEqual({ periodId: null, overLimit: false })
    expect(await recordVisit({ memberId: m.id, gymId: graceGym.gymId, channel: 'fichaje_public', visit: decision.visit! })).toBe(true)

    await pay(m.id, {}, graceGym)
    expect(await getMemberStanding(m.id, graceGym.gymId)).toMatchObject({
      status: 'active',
      creditsUsed: 1,
      creditsLeft: 11,
    })
  })

  it('denies check-in once grace runs out', async () => {
    const m = await createMember(graceGym.gymId)
    const start = addDays(today, -40)
    await pay(m.id, { paymentDate: start, startDate: start }, graceGym)
    await db.execute(sql`UPDATE membership_periods SET end_date = ${today}::date - 3 WHERE member_id = ${m.id}::uuid`)
    const decision = await evaluateMemberFichaje(m, graceGym.gymId)
    expect(decision.result.status).toBe('expired')
    expect(decision.visit).toBeNull()
  })
})

describe('grace from the billing cutover', () => {
  // Switched two days ago with 3 grace days: every member expired before the
  // switch is in grace until tomorrow, however long ago their period ended.
  let cutoverGym: TestGym
  beforeAll(async () => {
    cutoverGym = await createTestGym({ graceDays: 3, billingCutoverDate: addDays(today, -2) })
  })
  afterAll(async () => deleteTestGym(cutoverGym))

  async function expiredLongAgo() {
    const m = await createMember(cutoverGym.gymId)
    const start = addDays(today, -100)
    await pay(m.id, { paymentDate: start, startDate: start }, cutoverGym)
    return m
  }

  it('counts grace from the cutover when the member expired before it', async () => {
    const m = await expiredLongAgo()
    expect(await getMemberStanding(m.id, cutoverGym.gymId)).toMatchObject({
      status: 'grace',
      graceDaysLeft: 1,
    })
    const decision = await evaluateMemberFichaje(m, cutoverGym.gymId)
    expect(decision.result).toMatchObject({ status: 'grace_allowed', graceDaysLeft: 1 })
  })

  it('expires once grace from the cutover runs out', async () => {
    const lateGym = await createTestGym({ graceDays: 3, billingCutoverDate: addDays(today, -5) })
    try {
      const m = await createMember(lateGym.gymId)
      const start = addDays(today, -100)
      await pay(m.id, { paymentDate: start, startDate: start }, lateGym)
      expect((await evaluateMemberFichaje(m, lateGym.gymId)).result.status).toBe('expired')
    } finally {
      await deleteTestGym(lateGym)
    }
  })

  it('never charges visits from before the cutover to the next period', async () => {
    const m = await expiredLongAgo()
    await insertVisitOn(cutoverGym.gymId, m.id, addDays(today, -10)) // old model
    await insertVisitOn(cutoverGym.gymId, m.id, addDays(today, -1)) // grace, after the switch
    expect((await getMemberStanding(m.id, cutoverGym.gymId))?.graceVisits).toBe(1)

    await pay(m.id, {}, cutoverGym)
    expect(await getMemberStanding(m.id, cutoverGym.gymId)).toMatchObject({
      status: 'active',
      creditsUsed: 1,
      creditsLeft: 11,
    })
  })

  it('does not give grace to members who never paid', async () => {
    const m = await createMember(cutoverGym.gymId)
    expect((await evaluateMemberFichaje(m, cutoverGym.gymId)).result.status).toBe('no_plan')
  })
})

describe('check-in', () => {
  it('records one visit per day; a second attempt is already_today and the insert is a no-op', async () => {
    const m = await createMember(gym.gymId)
    await pay(m.id)
    const first = await evaluateMemberFichaje(m, gym.gymId)
    expect(first.result).toMatchObject({ status: 'ok', creditsLeft: 12, validUntil: addDays(expectedFirst(today).endDate, -1) })
    expect(await recordVisit({ memberId: m.id, gymId: gym.gymId, channel: 'fichaje_admin', visit: first.visit! })).toBe(true)

    // A stale decision (double tap) must not create a second visit.
    expect(await recordVisit({ memberId: m.id, gymId: gym.gymId, channel: 'fichaje_admin', visit: first.visit! })).toBe(false)
    expect((await evaluateMemberFichaje(m, gym.gymId)).result.status).toBe('already_today')
    expect((await getMemberStanding(m.id, gym.gymId))?.creditsLeft).toBe(11)
  })

  it('out of credits: denied by default, allowed as over_limit when the gym allows it', async () => {
    const m = await createMember(gym.gymId)
    await pay(m.id, { planId: gym.plans.credits1, paymentDate: addDays(today, -1) })
    await insertVisitOn(gym.gymId, m.id, addDays(today, -1), (await periodsOf(m.id))[0].id)
    expect((await evaluateMemberFichaje(m, gym.gymId)).result.status).toBe('over_limit_denied')

    const lenient = await createTestGym({ allowOverLimit: true })
    try {
      const l = await createMember(lenient.gymId)
      await recordPayment({ gymId: lenient.gymId, memberId: l.id, planId: lenient.plans.credits1, amountArs: 1, paymentDate: addDays(today, -1) })
      await insertVisitOn(lenient.gymId, l.id, addDays(today, -1), (await periodsOf(l.id))[0].id)
      const d = await evaluateMemberFichaje(l, lenient.gymId)
      expect(d.result.status).toBe('over_limit_allowed')
      expect(d.visit).toMatchObject({ overLimit: true })
    } finally {
      await deleteTestGym(lenient)
    }
  })

  it('unlimited plans never run out', async () => {
    const m = await createMember(gym.gymId)
    await pay(m.id, { planId: gym.plans.unlimited })
    expect((await evaluateMemberFichaje(m, gym.gymId)).result).toMatchObject({ status: 'ok', creditsLeft: null })
  })

  it('members who never paid are no_plan', async () => {
    const m = await createMember(gym.gymId)
    expect((await evaluateMemberFichaje(m, gym.gymId)).result.status).toBe('no_plan')
  })
})

describe('deletePayment', () => {
  it('removes the period and frees its visits', async () => {
    const m = await createMember(gym.gymId)
    await pay(m.id, { paymentDate: addDays(today, -2) })
    const [period] = await periodsOf(m.id)
    await insertVisitOn(gym.gymId, m.id, addDays(today, -1), period.id)
    const [{ payment_id }] = await db.execute<{ payment_id: string }>(
      sql`SELECT payment_id FROM membership_periods WHERE id = ${period.id}::uuid`,
    )

    expect(await deletePayment(other.gymId, payment_id)).toEqual({ error: 'Pago no encontrado' })
    expect(await deletePayment(gym.gymId, payment_id)).toEqual({ success: true })
    expect(await periodsOf(m.id)).toHaveLength(0)
    expect((await getMemberStanding(m.id, gym.gymId))?.status).toBe('no_plan')

    // Re-registering re-attaches the freed visit.
    await pay(m.id, { paymentDate: addDays(today, -2) })
    expect((await getMemberStanding(m.id, gym.gymId))?.creditsUsed).toBe(1)
  })
})
