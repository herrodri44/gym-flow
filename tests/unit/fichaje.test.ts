import { describe, it, expect } from 'vitest'
import { decideFichaje } from '@/lib/domain/fichaje'

// decideFichaje is the pure check-in rule set (PROJECT.md §5). The SQL side —
// member_standing, credit counting, one visit per day — is covered by
// tests/integration/billing.test.ts against a real Postgres.

const MEMBER = { id: 'member-1', fullName: 'Ana López', documentNumber: '12345678' }

type Standing = Parameters<typeof decideFichaje>[1]

const ACTIVE_CREDITS: Standing = {
  status: 'active',
  periodId: 'period-1',
  planType: 'credits',
  startDate: '2026-10-05',
  endDate: '2026-11-05',
  creditsLeft: 4,
  allowOverLimit: false,
  graceDaysLeft: null,
}

const standing = (overrides: Partial<Standing>): Standing => ({ ...ACTIVE_CREDITS, ...overrides })

describe('decideFichaje', () => {
  it('already checked in today wins over everything else, no visit', () => {
    expect(decideFichaje(MEMBER, ACTIVE_CREDITS, true)).toEqual({
      result: { status: 'already_today', member: MEMBER },
      visit: null,
    })
  })

  it('active with credits: ok, shows the last valid day, visit consumes the period', () => {
    expect(decideFichaje(MEMBER, ACTIVE_CREDITS, false)).toEqual({
      result: { status: 'ok', member: MEMBER, creditsLeft: 4, validUntil: '2026-11-04' },
      visit: { periodId: 'period-1', overLimit: false },
    })
  })

  it('unlimited plan: ok with creditsLeft null regardless of the count', () => {
    const d = decideFichaje(MEMBER, standing({ planType: 'unlimited', creditsLeft: null }), false)
    expect(d.result).toMatchObject({ status: 'ok', creditsLeft: null })
    expect(d.visit).toEqual({ periodId: 'period-1', overLimit: false })
  })

  it('out of credits and the gym denies: over_limit_denied, no visit', () => {
    const d = decideFichaje(MEMBER, standing({ creditsLeft: 0 }), false)
    expect(d.result).toEqual({ status: 'over_limit_denied', member: MEMBER, validUntil: '2026-11-04' })
    expect(d.visit).toBeNull()
  })

  it('negative balance (adjustments) is also out of credits', () => {
    expect(decideFichaje(MEMBER, standing({ creditsLeft: -1 }), false).result.status).toBe('over_limit_denied')
  })

  it('out of credits and the gym allows it: over_limit_allowed, visit flagged over limit', () => {
    const d = decideFichaje(MEMBER, standing({ creditsLeft: 0, allowOverLimit: true }), false)
    expect(d.result.status).toBe('over_limit_allowed')
    expect(d.visit).toEqual({ periodId: 'period-1', overLimit: true })
  })

  it('grace: allowed with a warning, visit has no period yet (next payment attaches it)', () => {
    const d = decideFichaje(
      MEMBER,
      standing({ status: 'grace', graceDaysLeft: 2, endDate: '2026-11-05' }),
      false,
    )
    expect(d.result).toEqual({ status: 'grace_allowed', member: MEMBER, expiredOn: '2026-11-05', graceDaysLeft: 2 })
    expect(d.visit).toEqual({ periodId: null, overLimit: false })
  })

  it('grace ignores allow_over_limit and credits: the old period is over', () => {
    const d = decideFichaje(
      MEMBER,
      standing({ status: 'grace', graceDaysLeft: 2, creditsLeft: 0 }),
      false,
    )
    expect(d.result.status).toBe('grace_allowed')
  })

  it('expired: denied with the expiry date', () => {
    expect(decideFichaje(MEMBER, standing({ status: 'expired' }), false)).toEqual({
      result: { status: 'expired', member: MEMBER, expiredOn: '2026-11-05' },
      visit: null,
    })
  })

  it('never paid: no_plan', () => {
    const d = decideFichaje(MEMBER, standing({ status: 'no_plan', periodId: null, endDate: null }), false)
    expect(d).toEqual({ result: { status: 'no_plan', member: MEMBER }, visit: null })
  })

  it('period starts in the future: not_started with the start date', () => {
    const d = decideFichaje(MEMBER, standing({ status: 'not_started', startDate: '2026-12-01' }), false)
    expect(d).toEqual({ result: { status: 'not_started', member: MEMBER, startsOn: '2026-12-01' }, visit: null })
  })
})
