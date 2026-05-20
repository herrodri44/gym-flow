import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSelectChain, makeInsertMock, makeUpdateMock } from '../helpers/db-mock'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockInsert = makeInsertMock()
const { mock: mockUpdate, setFn: mockSet, whereFn: mockUpdateWhere } = makeUpdateMock()
const mockExecute = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/db/client', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    execute: mockExecute,
  },
}))

const { enrollMember } = await import('@/lib/domain/enrollment')

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GYM_ID = 'gym-1'
const MEMBER_ID = 'member-1'
const PLAN_ID = 'plan-1'

const MEMBER_ROW = { id: MEMBER_ID }
const PLAN_ROW = { id: PLAN_ID, priceArs: 150000 }
const GYM_ROW = { timezone: 'America/Argentina/Buenos_Aires' }

function setupSuccessSelects() {
  mockSelect
    .mockReturnValueOnce(makeSelectChain([MEMBER_ROW]))
    .mockReturnValueOnce(makeSelectChain([PLAN_ROW]))
    .mockReturnValueOnce(makeSelectChain([GYM_ROW]))
}

beforeEach(() => {
  mockSelect.mockReset()
  mockInsert.mockClear()
  mockUpdate.mockClear()
  mockSet.mockClear()
  mockUpdateWhere.mockClear()
  mockExecute.mockClear()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('enrollMember', () => {
  it('returns { error } when member does not belong to the gym', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))         // member not found
      .mockReturnValueOnce(makeSelectChain([PLAN_ROW]))
      .mockReturnValueOnce(makeSelectChain([GYM_ROW]))

    const result = await enrollMember({ gymId: GYM_ID, memberId: MEMBER_ID, planId: PLAN_ID })

    expect(result).toEqual({ error: 'Socio no encontrado' })
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('returns { error } when plan does not belong to the gym', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([MEMBER_ROW]))
      .mockReturnValueOnce(makeSelectChain([]))          // plan not found
      .mockReturnValueOnce(makeSelectChain([GYM_ROW]))

    const result = await enrollMember({ gymId: GYM_ID, memberId: MEMBER_ID, planId: PLAN_ID })

    expect(result).toEqual({ error: 'Plan no encontrado' })
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('deactivates existing enrollment before inserting the new one', async () => {
    setupSuccessSelects()

    await enrollMember({ gymId: GYM_ID, memberId: MEMBER_ID, planId: PLAN_ID })

    const updateOrder = mockUpdate.mock.invocationCallOrder[0]
    const insertOrder = mockInsert.mock.invocationCallOrder[0]
    expect(updateOrder).toBeLessThan(insertOrder)

    const setArgs = mockSet.mock.calls[0][0] as Record<string, unknown>
    expect(setArgs.active).toBe(false)
    expect(setArgs.endedAt).toBeInstanceOf(Date)
  })

  it('inserts new enrollment with active: true', async () => {
    setupSuccessSelects()

    await enrollMember({ gymId: GYM_ID, memberId: MEMBER_ID, planId: PLAN_ID })

    const insertValues = mockInsert.mock.results[0].value.values.mock.calls[0][0] as Record<
      string,
      unknown
    >
    expect(insertValues.active).toBe(true)
    expect(insertValues.memberId).toBe(MEMBER_ID)
    expect(insertValues.planId).toBe(PLAN_ID)
    expect(insertValues.gymId).toBe(GYM_ID)
  })

  it('creates a pending payment record after enrollment', async () => {
    setupSuccessSelects()

    await enrollMember({ gymId: GYM_ID, memberId: MEMBER_ID, planId: PLAN_ID })

    expect(mockExecute).toHaveBeenCalledOnce()

    // Payment insert must happen after enrollment insert
    const insertOrder = mockInsert.mock.invocationCallOrder[0]
    const executeOrder = mockExecute.mock.invocationCallOrder[0]
    expect(insertOrder).toBeLessThan(executeOrder)
  })

  it('returns { success: true } on valid enrollment', async () => {
    setupSuccessSelects()

    const result = await enrollMember({ gymId: GYM_ID, memberId: MEMBER_ID, planId: PLAN_ID })

    expect(result).toEqual({ success: true })
  })
})
