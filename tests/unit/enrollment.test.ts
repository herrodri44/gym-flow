import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSelectChain, makeInsertMock, makeUpdateMock } from '../helpers/db-mock'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockInsert = makeInsertMock()
const { mock: mockUpdate, setFn: mockSet, whereFn: mockUpdateWhere } = makeUpdateMock()

vi.mock('@/lib/db/client', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const mockRequireGymAdmin = vi.fn()
vi.mock('@/lib/auth/context', () => ({
  requireGymAdmin: mockRequireGymAdmin,
}))

const { enrollMemberAction } = await import('@/app/admin/(protected)/plans/actions')

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUTH_CTX = { user: { id: 'admin-1' }, gymId: 'gym-1' }

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

const VALID_FORM = makeFormData({
  memberId: 'member-1',
  planId: 'plan-1',
  startedAt: '2026-05-01',
})

beforeEach(() => {
  mockSelect.mockReset()
  mockInsert.mockClear()
  mockUpdate.mockClear()
  mockSet.mockClear()
  mockUpdateWhere.mockClear()
  mockRequireGymAdmin.mockReset()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('enrollMemberAction', () => {
  it('returns { error } when user is not authenticated', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(null)

    const result = await enrollMemberAction(VALID_FORM)

    expect(result).toEqual({ error: 'No autorizado' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns { error } when member does not belong to the gym', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))  // member not found

    const result = await enrollMemberAction(VALID_FORM)

    expect(result).toEqual({ error: 'Socio no encontrado' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns { error } when plan does not belong to the gym', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'member-1' }]))  // member found
      .mockReturnValueOnce(makeSelectChain([]))                     // plan not found

    const result = await enrollMemberAction(VALID_FORM)

    expect(result).toEqual({ error: 'Plan no encontrado' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('deactivates existing enrollment before inserting the new one', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'member-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'plan-1' }]))

    const result = await enrollMemberAction(VALID_FORM)

    expect(result).toEqual({ success: true })

    // update must be called before insert
    const updateOrder = mockUpdate.mock.invocationCallOrder[0]
    const insertOrder = mockInsert.mock.invocationCallOrder[0]
    expect(updateOrder).toBeLessThan(insertOrder)

    // update sets active to false and records endedAt
    const setArgs = mockSet.mock.calls[0][0] as Record<string, unknown>
    expect(setArgs.active).toBe(false)
    expect(setArgs.endedAt).toBeInstanceOf(Date)
  })

  it('inserts new enrollment with active: true', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'member-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'plan-1' }]))

    await enrollMemberAction(VALID_FORM)

    const insertValues = mockInsert.mock.results[0].value.values.mock.calls[0][0] as Record<
      string,
      unknown
    >
    expect(insertValues.active).toBe(true)
    expect(insertValues.memberId).toBe('member-1')
    expect(insertValues.planId).toBe('plan-1')
    expect(insertValues.gymId).toBe('gym-1')
  })

  it('returns { error } when memberId or planId is missing', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)

    const fd = makeFormData({ memberId: '', planId: '' })
    const result = await enrollMemberAction(fd)

    expect(result).toEqual({ error: 'Faltan datos requeridos' })
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
