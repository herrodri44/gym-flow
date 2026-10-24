import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSelectChain } from '../helpers/db-mock'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockSelect = vi.fn()

vi.mock('@/lib/db/client', () => ({
  db: { select: mockSelect },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

const mockValidateFichaje = vi.fn()
const mockRecordVisit = vi.fn()

vi.mock('@/lib/domain/fichaje', () => ({
  validateFichaje: mockValidateFichaje,
  recordVisit: mockRecordVisit,
}))

const { publicFichajeAction } = await import('@/app/g/[slug]/actions')

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GYM = { id: 'gym-1' }
const MEMBER = { id: 'member-1', fullName: 'Ana López', documentNumber: '12345678' }
const OK_VISIT = { periodId: 'period-1', overLimit: false }

function withGym() {
  mockSelect.mockReturnValueOnce(makeSelectChain([GYM]))
}

beforeEach(() => {
  mockSelect.mockReset()
  mockValidateFichaje.mockReset()
  mockRecordVisit.mockReset()
  mockRecordVisit.mockResolvedValue(true)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('publicFichajeAction', () => {
  it('returns not_found for an empty document number without touching the DB', async () => {
    expect(await publicFichajeAction('my-gym', '  ')).toEqual({ status: 'not_found' })
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('returns invalid_gym when the slug does not match any gym', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    expect(await publicFichajeAction('unknown-slug', '12345678')).toEqual({ status: 'invalid_gym' })
    expect(mockValidateFichaje).not.toHaveBeenCalled()
  })

  it('searches by DNI on the public channel', async () => {
    withGym()
    mockValidateFichaje.mockResolvedValueOnce({ result: { status: 'not_found' }, visit: null })
    await publicFichajeAction('my-gym', ' 12345678 ')
    expect(mockValidateFichaje).toHaveBeenCalledWith('12345678', GYM.id, 'fichaje_public')
  })

  it('records the visit and returns credits left after it, without member data', async () => {
    withGym()
    mockValidateFichaje.mockResolvedValueOnce({
      result: { status: 'ok', member: MEMBER, creditsLeft: 5, validUntil: '2026-11-04' },
      visit: OK_VISIT,
    })

    const result = await publicFichajeAction('my-gym', MEMBER.documentNumber)

    expect(mockRecordVisit).toHaveBeenCalledWith({
      memberId: MEMBER.id,
      gymId: GYM.id,
      channel: 'fichaje_public',
      visit: OK_VISIT,
    })
    expect(result).toEqual({ status: 'ok', creditsLeft: 4, validUntil: '2026-11-04' })
  })

  it('never leaks the member name or DNI, whatever the outcome', async () => {
    const outcomes = [
      { result: { status: 'expired', member: MEMBER, expiredOn: '2026-11-05' }, visit: null },
      { result: { status: 'no_plan', member: MEMBER }, visit: null },
      { result: { status: 'over_limit_denied', member: MEMBER, validUntil: '2026-11-04' }, visit: null },
      { result: { status: 'grace_allowed', member: MEMBER, expiredOn: '2026-11-05', graceDaysLeft: 2 }, visit: { periodId: null, overLimit: false } },
    ]
    for (const outcome of outcomes) {
      withGym()
      mockValidateFichaje.mockResolvedValueOnce(outcome)
      const json = JSON.stringify(await publicFichajeAction('my-gym', MEMBER.documentNumber))
      expect(json).not.toContain(MEMBER.fullName)
      expect(json).not.toContain(MEMBER.documentNumber)
      expect(json).not.toContain(MEMBER.id)
    }
  })

  it('records grace and over-limit visits as decided by the domain', async () => {
    withGym()
    const graceVisit = { periodId: null, overLimit: false }
    mockValidateFichaje.mockResolvedValueOnce({
      result: { status: 'grace_allowed', member: MEMBER, expiredOn: '2026-11-05', graceDaysLeft: 2 },
      visit: graceVisit,
    })
    expect(await publicFichajeAction('my-gym', MEMBER.documentNumber)).toEqual({
      status: 'grace_allowed',
      expiredOn: '2026-11-05',
      graceDaysLeft: 2,
    })
    expect(mockRecordVisit).toHaveBeenCalledWith(expect.objectContaining({ visit: graceVisit }))
  })

  it('a lost race on the one-visit-per-day constraint reports already_today', async () => {
    withGym()
    mockValidateFichaje.mockResolvedValueOnce({
      result: { status: 'ok', member: MEMBER, creditsLeft: 5, validUntil: '2026-11-04' },
      visit: OK_VISIT,
    })
    mockRecordVisit.mockResolvedValueOnce(false)
    expect(await publicFichajeAction('my-gym', MEMBER.documentNumber)).toEqual({ status: 'already_today' })
  })

  it.each(['already_today', 'expired', 'no_plan', 'over_limit_denied', 'not_started'])(
    'does not record a visit when the domain returns no visit (%s)',
    async (status) => {
      withGym()
      mockValidateFichaje.mockResolvedValueOnce({ result: { status, member: MEMBER }, visit: null })
      await publicFichajeAction('my-gym', MEMBER.documentNumber)
      expect(mockRecordVisit).not.toHaveBeenCalled()
    },
  )

  it('returns { status: error } instead of throwing when the insert fails', async () => {
    withGym()
    mockValidateFichaje.mockResolvedValueOnce({
      result: { status: 'ok', member: MEMBER, creditsLeft: 5, validUntil: '2026-11-04' },
      visit: OK_VISIT,
    })
    mockRecordVisit.mockRejectedValueOnce(new Error('db down'))
    expect(await publicFichajeAction('my-gym', MEMBER.documentNumber)).toEqual({ status: 'error' })
  })
})
