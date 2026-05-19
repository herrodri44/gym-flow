import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSelectChain } from '../helpers/db-mock'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockInsert = vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@/lib/db/client', () => ({
  db: { select: mockSelect, insert: mockInsert },
}))

const mockValidateFichaje = vi.fn()
const mockRecordVisit = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/domain/fichaje', () => ({
  validateFichaje: mockValidateFichaje,
  recordVisit: mockRecordVisit,
}))

const { publicFichajeAction } = await import('@/app/g/[slug]/actions')

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GYM = { id: 'gym-1', timezone: 'America/Argentina/Buenos_Aires' }
const MEMBER = { id: 'member-1', fullName: 'Ana López', documentNumber: '12345678' }

beforeEach(() => {
  mockSelect.mockReset()
  mockValidateFichaje.mockReset()
  mockRecordVisit.mockClear()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('publicFichajeAction', () => {
  it('returns not_found for an empty document number', async () => {
    const result = await publicFichajeAction('my-gym', '  ')
    expect(result).toEqual({ status: 'not_found' })
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('returns invalid_gym when the slug does not match any gym', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))

    const result = await publicFichajeAction('unknown-slug', '12345678')

    expect(result).toEqual({ status: 'invalid_gym' })
    expect(mockValidateFichaje).not.toHaveBeenCalled()
  })

  it('calls validateFichaje with correct gymId, timezone, and public channel', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([GYM]))
    mockValidateFichaje.mockResolvedValueOnce({ status: 'not_found' })

    await publicFichajeAction('my-gym', '12345678')

    expect(mockValidateFichaje).toHaveBeenCalledWith(
      '12345678',
      GYM.id,
      GYM.timezone,
      'fichaje_public',
    )
  })

  it('calls recordVisit with overLimit=false when validation is ok', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([GYM]))
    mockValidateFichaje.mockResolvedValueOnce({ status: 'ok', member: MEMBER, creditsLeft: 5 })

    const result = await publicFichajeAction('my-gym', MEMBER.documentNumber)

    expect(mockRecordVisit).toHaveBeenCalledWith(MEMBER.id, GYM.id, 'fichaje_public', false)
    expect(result).toEqual({ status: 'ok', member: MEMBER, creditsLeft: 5 })
  })

  it('calls recordVisit with overLimit=true when validation is over_limit_allowed', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([GYM]))
    mockValidateFichaje.mockResolvedValueOnce({ status: 'over_limit_allowed', member: MEMBER })

    const result = await publicFichajeAction('my-gym', MEMBER.documentNumber)

    expect(mockRecordVisit).toHaveBeenCalledWith(MEMBER.id, GYM.id, 'fichaje_public', true)
    expect(result).toEqual({ status: 'over_limit_allowed', member: MEMBER })
  })

  it('does not call recordVisit for already_today', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([GYM]))
    mockValidateFichaje.mockResolvedValueOnce({ status: 'already_today', member: MEMBER })

    const result = await publicFichajeAction('my-gym', MEMBER.documentNumber)

    expect(mockRecordVisit).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'already_today', member: MEMBER })
  })

  it('does not call recordVisit for not_found', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([GYM]))
    mockValidateFichaje.mockResolvedValueOnce({ status: 'not_found' })

    await publicFichajeAction('my-gym', '99999999')

    expect(mockRecordVisit).not.toHaveBeenCalled()
  })

  it('does not call recordVisit for over_limit_denied', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([GYM]))
    mockValidateFichaje.mockResolvedValueOnce({ status: 'over_limit_denied', member: MEMBER })

    await publicFichajeAction('my-gym', MEMBER.documentNumber)

    expect(mockRecordVisit).not.toHaveBeenCalled()
  })

  it('does not call recordVisit for no_active_enrollment', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([GYM]))
    mockValidateFichaje.mockResolvedValueOnce({ status: 'no_active_enrollment', member: MEMBER })

    await publicFichajeAction('my-gym', MEMBER.documentNumber)

    expect(mockRecordVisit).not.toHaveBeenCalled()
  })
})
