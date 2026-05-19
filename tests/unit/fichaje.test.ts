import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSelectChain } from '../helpers/db-mock'

const mockSelect = vi.fn()

vi.mock('@/lib/db/client', () => ({
  db: { select: mockSelect },
}))

// Mock credits module so validateMemberFichaje tests control credit results directly
const mockGetAvailableCredits = vi.fn()
vi.mock('@/lib/domain/credits', () => ({
  getAvailableCredits: mockGetAvailableCredits,
}))

const { validateFichaje, validateMemberFichaje } = await import('@/lib/domain/fichaje')

const GYM_ID = 'gym-1'
const TIMEZONE = 'America/Argentina/Buenos_Aires'

const MEMBER = {
  id: 'member-1',
  fullName: 'Juan Pérez',
  documentNumber: '12345678',
}

beforeEach(() => {
  mockSelect.mockReset()
  mockGetAvailableCredits.mockReset()
})

// ─── validateFichaje ──────────────────────────────────────────────────────────

describe('validateFichaje', () => {
  it('returns not_found for an empty query', async () => {
    const result = await validateFichaje('  ', GYM_ID, TIMEZONE, 'fichaje_public')
    expect(result).toEqual({ status: 'not_found' })
  })

  it('returns not_found when no member matches (public channel)', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))

    const result = await validateFichaje('99999999', GYM_ID, TIMEZONE, 'fichaje_public')

    expect(result).toEqual({ status: 'not_found' })
  })

  it('returns not_found when no member matches (admin channel)', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))

    const result = await validateFichaje('nobody', GYM_ID, TIMEZONE, 'fichaje_admin')

    expect(result).toEqual({ status: 'not_found' })
  })

  it('returns multiple_matches when admin search finds more than one member', async () => {
    const members = [
      { id: 'member-1', fullName: 'Juan Pérez', documentNumber: '11111111' },
      { id: 'member-2', fullName: 'Juan García', documentNumber: '22222222' },
    ]
    mockSelect.mockReturnValueOnce(makeSelectChain(members))

    // Downstream queries for validateMemberFichaje are not reached
    const result = await validateFichaje('Juan', GYM_ID, TIMEZONE, 'fichaje_admin')

    expect(result).toEqual({ status: 'multiple_matches', members })
  })

  it('delegates to validateMemberFichaje when exactly one member matches', async () => {
    // Member found — then: no visit today, credits available
    mockSelect
      .mockReturnValueOnce(makeSelectChain([MEMBER])) // member search
      .mockReturnValueOnce(makeSelectChain([]))        // no visit today
    mockGetAvailableCredits.mockResolvedValueOnce(5)

    const result = await validateFichaje(MEMBER.documentNumber, GYM_ID, TIMEZONE, 'fichaje_public')

    expect(result).toEqual({ status: 'ok', member: MEMBER, creditsLeft: 5 })
  })
})

// ─── validateMemberFichaje ────────────────────────────────────────────────────

describe('validateMemberFichaje', () => {
  it('returns already_today when the member already visited today', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([{ id: 'visit-1' }]))

    const result = await validateMemberFichaje(MEMBER, GYM_ID, TIMEZONE)

    expect(result).toEqual({ status: 'already_today', member: MEMBER })
  })

  it('returns no_active_enrollment when getAvailableCredits returns null', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    mockGetAvailableCredits.mockResolvedValueOnce(null)

    const result = await validateMemberFichaje(MEMBER, GYM_ID, TIMEZONE)

    expect(result).toEqual({ status: 'no_active_enrollment', member: MEMBER })
  })

  it('returns ok with creditsLeft: null for unlimited plans', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    mockGetAvailableCredits.mockResolvedValueOnce(Infinity)

    const result = await validateMemberFichaje(MEMBER, GYM_ID, TIMEZONE)

    expect(result).toEqual({ status: 'ok', member: MEMBER, creditsLeft: null })
  })

  it('returns ok with remaining credits when member has credits', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    mockGetAvailableCredits.mockResolvedValueOnce(4)

    const result = await validateMemberFichaje(MEMBER, GYM_ID, TIMEZONE)

    expect(result).toEqual({ status: 'ok', member: MEMBER, creditsLeft: 4 })
  })

  it('returns over_limit_allowed when credits are 0 and gym allows over-limit', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))                          // no visit today
      .mockReturnValueOnce(makeSelectChain([{ allowOverLimit: true }]))  // gym settings
    mockGetAvailableCredits.mockResolvedValueOnce(0)

    const result = await validateMemberFichaje(MEMBER, GYM_ID, TIMEZONE)

    expect(result).toEqual({ status: 'over_limit_allowed', member: MEMBER })
  })

  it('returns over_limit_denied when credits are 0 and gym denies over-limit', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))                           // no visit today
      .mockReturnValueOnce(makeSelectChain([{ allowOverLimit: false }]))  // gym settings
    mockGetAvailableCredits.mockResolvedValueOnce(0)

    const result = await validateMemberFichaje(MEMBER, GYM_ID, TIMEZONE)

    expect(result).toEqual({ status: 'over_limit_denied', member: MEMBER })
  })

  it('returns over_limit_denied when credits are 0 and gymSettings row is missing', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))  // no visit today
      .mockReturnValueOnce(makeSelectChain([]))  // no gymSettings row
    mockGetAvailableCredits.mockResolvedValueOnce(0)

    const result = await validateMemberFichaje(MEMBER, GYM_ID, TIMEZONE)

    expect(result).toEqual({ status: 'over_limit_denied', member: MEMBER })
  })

  it('passes gymId and gymTimezone to getAvailableCredits', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))
    mockGetAvailableCredits.mockResolvedValueOnce(3)

    await validateMemberFichaje(MEMBER, GYM_ID, TIMEZONE)

    expect(mockGetAvailableCredits).toHaveBeenCalledWith(MEMBER.id, GYM_ID, TIMEZONE)
  })
})
