import { describe, it, expect } from 'vitest'
import { calculateNextPeriod, addDays } from '@/lib/domain/period-math'

// Dates are gym-local calendar dates ('YYYY-MM-DD'). endDate is exclusive:
// a period paid on Oct 5 is valid through Nov 4 and renewal is due Nov 5.

describe('calculateNextPeriod — first payment / late renewal (B1, B2)', () => {
  it('first payment starts on the payment date and ends one month later', () => {
    expect(calculateNextPeriod({ lastPeriod: null, paymentDate: '2026-10-05' })).toEqual({
      startDate: '2026-10-05',
      endDate: '2026-11-05',
      anchorDay: 5,
    })
  })

  it('crosses the year boundary', () => {
    expect(calculateNextPeriod({ lastPeriod: null, paymentDate: '2026-12-15' })).toMatchObject({
      startDate: '2026-12-15',
      endDate: '2027-01-15',
    })
  })

  it('late renewal starts on the payment date and sets a new anchor day', () => {
    const lastPeriod = { endDate: '2026-11-05', anchorDay: 5 }
    expect(calculateNextPeriod({ lastPeriod, paymentDate: '2026-11-12' })).toEqual({
      startDate: '2026-11-12',
      endDate: '2026-12-12',
      anchorDay: 12,
    })
  })
})

describe('calculateNextPeriod — early or on-time renewal (B3)', () => {
  it('early renewal starts when the current period ends and keeps the anchor', () => {
    const lastPeriod = { endDate: '2026-11-05', anchorDay: 5 }
    expect(calculateNextPeriod({ lastPeriod, paymentDate: '2026-11-02' })).toEqual({
      startDate: '2026-11-05',
      endDate: '2026-12-05',
      anchorDay: 5,
    })
  })

  it('paying exactly on the due date is a contiguous renewal', () => {
    const lastPeriod = { endDate: '2026-11-05', anchorDay: 5 }
    expect(calculateNextPeriod({ lastPeriod, paymentDate: '2026-11-05' })).toEqual({
      startDate: '2026-11-05',
      endDate: '2026-12-05',
      anchorDay: 5,
    })
  })
})

describe('calculateNextPeriod — end of month (B4)', () => {
  it('Jan 31 clamps to Feb 28 in a non-leap year', () => {
    expect(calculateNextPeriod({ lastPeriod: null, paymentDate: '2027-01-31' })).toEqual({
      startDate: '2027-01-31',
      endDate: '2027-02-28',
      anchorDay: 31,
    })
  })

  it('Jan 31 clamps to Feb 29 in a leap year', () => {
    expect(calculateNextPeriod({ lastPeriod: null, paymentDate: '2028-01-31' })).toMatchObject({
      endDate: '2028-02-29',
    })
  })

  it('contiguous renewal after a clamped month returns to the anchor day', () => {
    // Jan 31 → Feb 28 → Mar 31 → Apr 30
    const feb = { endDate: '2027-02-28', anchorDay: 31 }
    const mar = calculateNextPeriod({ lastPeriod: feb, paymentDate: '2027-02-27' })
    expect(mar).toEqual({ startDate: '2027-02-28', endDate: '2027-03-31', anchorDay: 31 })

    const apr = calculateNextPeriod({ lastPeriod: { endDate: '2027-03-31', anchorDay: 31 }, paymentDate: '2027-03-31' })
    expect(apr).toEqual({ startDate: '2027-03-31', endDate: '2027-04-30', anchorDay: 31 })
  })

  it('day 30 payment in January ends Feb 28, then Mar 30', () => {
    const first = calculateNextPeriod({ lastPeriod: null, paymentDate: '2027-01-30' })
    expect(first).toMatchObject({ endDate: '2027-02-28', anchorDay: 30 })
    if ('error' in first) throw new Error('unexpected')
    const next = calculateNextPeriod({ lastPeriod: first, paymentDate: '2027-02-28' })
    expect(next).toMatchObject({ startDate: '2027-02-28', endDate: '2027-03-30' })
  })
})

describe('calculateNextPeriod — admin start override (B2)', () => {
  it('uses the override as start and anchor', () => {
    expect(
      calculateNextPeriod({ lastPeriod: null, paymentDate: '2026-10-07', startOverride: '2026-10-05' }),
    ).toEqual({ startDate: '2026-10-05', endDate: '2026-11-05', anchorDay: 5 })
  })

  it('an override on the previous end date keeps the previous anchor', () => {
    const lastPeriod = { endDate: '2027-02-28', anchorDay: 31 }
    expect(
      calculateNextPeriod({ lastPeriod, paymentDate: '2027-03-03', startOverride: '2027-02-28' }),
    ).toEqual({ startDate: '2027-02-28', endDate: '2027-03-31', anchorDay: 31 })
  })

  it('rejects an override that overlaps the previous period', () => {
    const lastPeriod = { endDate: '2026-11-05', anchorDay: 5 }
    expect(
      calculateNextPeriod({ lastPeriod, paymentDate: '2026-11-02', startOverride: '2026-11-01' }),
    ).toEqual({ error: 'overlaps_previous_period' })
  })

  it('rejects malformed dates', () => {
    expect(calculateNextPeriod({ lastPeriod: null, paymentDate: '2026-13-01' })).toEqual({ error: 'invalid_date' })
    expect(calculateNextPeriod({ lastPeriod: null, paymentDate: '2026-02-30' })).toEqual({ error: 'invalid_date' })
    expect(
      calculateNextPeriod({ lastPeriod: null, paymentDate: '2026-10-05', startOverride: '05/10/2026' }),
    ).toEqual({ error: 'invalid_date' })
  })
})

describe('addDays', () => {
  it('gives the last valid day of a period', () => {
    expect(addDays('2026-11-05', -1)).toBe('2026-11-04')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('crosses month and year boundaries forward', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-11-05', 0)).toBe('2026-11-05')
  })
})
