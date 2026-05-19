import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSelectChain } from '../helpers/db-mock'

const mockSelect = vi.fn()

vi.mock('@/lib/db/client', () => ({
  db: { select: mockSelect },
}))

// Import after mock registration
const { getAvailableCredits } = await import('@/lib/domain/credits')

beforeEach(() => {
  mockSelect.mockReset()
})

describe('getAvailableCredits', () => {
  it('returns null when the member has no active enrollment', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))

    const result = await getAvailableCredits('member-1', 'gym-1', 'America/Argentina/Buenos_Aires')

    expect(result).toBeNull()
  })

  it('returns Infinity for unlimited plans', async () => {
    mockSelect.mockReturnValueOnce(
      makeSelectChain([{ planType: 'unlimited', creditsPerMonth: null }]),
    )

    const result = await getAvailableCredits('member-1', 'gym-1', 'America/Argentina/Buenos_Aires')

    expect(result).toBe(Infinity)
  })

  it('returns remaining credits for a credits plan with no visits', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ planType: 'credits', creditsPerMonth: 12 }]))
      .mockReturnValueOnce(makeSelectChain([{ visitCount: 0 }]))
      .mockReturnValueOnce(makeSelectChain([{ adjustmentSum: null }]))

    const result = await getAvailableCredits('member-1', 'gym-1', 'America/Argentina/Buenos_Aires')

    expect(result).toBe(12)
  })

  it('decrements credits for each in-limit visit this month', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ planType: 'credits', creditsPerMonth: 12 }]))
      .mockReturnValueOnce(makeSelectChain([{ visitCount: 5 }]))
      .mockReturnValueOnce(makeSelectChain([{ adjustmentSum: null }]))

    const result = await getAvailableCredits('member-1', 'gym-1', 'America/Argentina/Buenos_Aires')

    expect(result).toBe(7)
  })

  it('returns 0 (not negative) when credits are exactly depleted', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ planType: 'credits', creditsPerMonth: 8 }]))
      .mockReturnValueOnce(makeSelectChain([{ visitCount: 8 }]))
      .mockReturnValueOnce(makeSelectChain([{ adjustmentSum: null }]))

    const result = await getAvailableCredits('member-1', 'gym-1', 'America/Argentina/Buenos_Aires')

    expect(result).toBe(0)
  })

  it('can return a negative value when visit count exceeds creditsPerMonth', async () => {
    // Over-limit visits are excluded from the count query, but this guards against
    // creditsPerMonth mismatches or manual adjustments that cause negative balances.
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ planType: 'credits', creditsPerMonth: 4 }]))
      .mockReturnValueOnce(makeSelectChain([{ visitCount: 6 }]))
      .mockReturnValueOnce(makeSelectChain([{ adjustmentSum: null }]))

    const result = await getAvailableCredits('member-1', 'gym-1', 'America/Argentina/Buenos_Aires')

    expect(result).toBe(-2)
  })

  it('adds positive credit adjustments to remaining credits', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ planType: 'credits', creditsPerMonth: 10 }]))
      .mockReturnValueOnce(makeSelectChain([{ visitCount: 10 }]))
      .mockReturnValueOnce(makeSelectChain([{ adjustmentSum: '3' }])) // Drizzle returns sum() as string

    const result = await getAvailableCredits('member-1', 'gym-1', 'America/Argentina/Buenos_Aires')

    expect(result).toBe(3)
  })

  it('subtracts negative credit adjustments', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ planType: 'credits', creditsPerMonth: 10 }]))
      .mockReturnValueOnce(makeSelectChain([{ visitCount: 3 }]))
      .mockReturnValueOnce(makeSelectChain([{ adjustmentSum: '-2' }]))

    const result = await getAvailableCredits('member-1', 'gym-1', 'America/Argentina/Buenos_Aires')

    expect(result).toBe(5)
  })
})
