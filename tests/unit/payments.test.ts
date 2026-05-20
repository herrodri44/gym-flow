import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSelectChain } from '../helpers/db-mock'
import { pesosTocentavos } from '@/lib/utils'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockInsertValues = vi.fn().mockResolvedValue(undefined)
const mockInsert = vi.fn(() => ({ values: mockInsertValues }))

const mockUpdateWhere = vi.fn().mockResolvedValue(undefined)
const mockSet = vi.fn((_args: Record<string, unknown>) => ({ where: mockUpdateWhere }))
const mockUpdate = vi.fn(() => ({ set: mockSet }))

const mockDeleteWhere = vi.fn().mockResolvedValue(undefined)
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }))

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockRequireGymAdmin = vi.fn()
vi.mock('@/lib/auth/context', () => ({
  requireGymAdmin: mockRequireGymAdmin,
}))

const { registerPaymentAction, markOverdueAction, updatePaymentStatusAction } =
  await import('@/app/admin/(protected)/payments/actions')

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUTH_CTX = { user: { id: 'admin-1' }, gymId: 'gym-1' }

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

beforeEach(() => {
  mockInsert.mockClear()
  mockInsertValues.mockClear()
  mockUpdate.mockClear()
  mockSet.mockClear()
  mockUpdateWhere.mockClear()
  mockRequireGymAdmin.mockReset()
})

// ─── registerPaymentAction ────────────────────────────────────────────────────

describe('registerPaymentAction', () => {
  it('returns { error } when not authenticated', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(null)
    const result = await registerPaymentAction(makeFormData({}))
    expect(result).toEqual({ error: 'No autorizado' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns { error } when memberId is missing', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    const result = await registerPaymentAction(
      makeFormData({ memberId: '', amountArs: '1000', month: '2026-05', status: 'paid' }),
    )
    expect(result).toEqual({ error: 'Seleccioná un socio' })
  })

  it('returns { error } when amountArs is not a number', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    const result = await registerPaymentAction(
      makeFormData({ memberId: 'm-1', amountArs: 'abc', month: '2026-05', status: 'paid' }),
    )
    expect(result).toEqual({ error: 'El monto es inválido' })
  })

  it('returns { error } when amountArs is negative', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    const result = await registerPaymentAction(
      makeFormData({ memberId: 'm-1', amountArs: '-50', month: '2026-05', status: 'paid' }),
    )
    expect(result).toEqual({ error: 'El monto es inválido' })
  })

  it('returns { error } when month has wrong format', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    const result = await registerPaymentAction(
      makeFormData({ memberId: 'm-1', amountArs: '1000', month: '05-2026', status: 'paid' }),
    )
    expect(result).toEqual({ error: 'El período es inválido' })
  })

  it('inserts with amountArs converted to centavos', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    await registerPaymentAction(
      makeFormData({ memberId: 'm-1', amountArs: '30000', month: '2026-05', status: 'paid' }),
    )
    const inserted = mockInsertValues.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.amountArs).toBe(pesosTocentavos(30000)) // 3_000_000 centavos
  })

  it('sets periodStart to first day and periodEnd to last day of the given month', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    await registerPaymentAction(
      makeFormData({ memberId: 'm-1', amountArs: '1000', month: '2026-05', status: 'paid' }),
    )
    const inserted = mockInsertValues.mock.calls[0][0] as Record<string, unknown>
    const start = inserted.periodStart as Date
    const end = inserted.periodEnd as Date
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(4) // May = index 4
    expect(start.getDate()).toBe(1)
    expect(end.getMonth()).toBe(4)
    expect(end.getDate()).toBe(31) // May has 31 days
  })

  it('sets paidAt to a Date when status is paid', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    await registerPaymentAction(
      makeFormData({ memberId: 'm-1', amountArs: '1000', month: '2026-05', status: 'paid' }),
    )
    const inserted = mockInsertValues.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.paidAt).toBeInstanceOf(Date)
  })

  it('sets paidAt to null when status is pending', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    await registerPaymentAction(
      makeFormData({ memberId: 'm-1', amountArs: '1000', month: '2026-05', status: 'pending' }),
    )
    const inserted = mockInsertValues.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.paidAt).toBeNull()
  })

  it('returns { success: true } on happy path', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    const result = await registerPaymentAction(
      makeFormData({ memberId: 'm-1', amountArs: '1000', month: '2026-05', status: 'paid' }),
    )
    expect(result).toEqual({ success: true })
  })
})

// ─── markOverdueAction ────────────────────────────────────────────────────────

describe('markOverdueAction', () => {
  it('returns { error } when not authenticated', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(null)
    const result = await markOverdueAction()
    expect(result).toEqual({ error: 'No autorizado' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('calls update with status: overdue', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    await markOverdueAction()
    const setArgs = mockSet.mock.calls[0][0] as Record<string, unknown>
    expect(setArgs.status).toBe('overdue')
  })

  it('returns { success: true }', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    const result = await markOverdueAction()
    expect(result).toEqual({ success: true })
  })
})

// ─── updatePaymentStatusAction ────────────────────────────────────────────────

describe('updatePaymentStatusAction', () => {
  it('returns { error } when not authenticated', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(null)
    const result = await updatePaymentStatusAction(makeFormData({}))
    expect(result).toEqual({ error: 'No autorizado' })
  })

  it('returns { error } when paymentId is missing', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    const result = await updatePaymentStatusAction(
      makeFormData({ paymentId: '', status: 'paid' }),
    )
    expect(result).toEqual({ error: 'Datos inválidos' })
  })

  it('returns { error } when status is not a valid value', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    const result = await updatePaymentStatusAction(
      makeFormData({ paymentId: 'pay-1', status: 'cancelled' }),
    )
    expect(result).toEqual({ error: 'Datos inválidos' })
  })

  it('sets paidAt to a Date when transitioning to paid', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    await updatePaymentStatusAction(makeFormData({ paymentId: 'pay-1', status: 'paid' }))
    const setArgs = mockSet.mock.calls[0][0] as Record<string, unknown>
    expect(setArgs.paidAt).toBeInstanceOf(Date)
  })

  it('sets paidAt to null when transitioning to pending', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    await updatePaymentStatusAction(makeFormData({ paymentId: 'pay-1', status: 'pending' }))
    const setArgs = mockSet.mock.calls[0][0] as Record<string, unknown>
    expect(setArgs.paidAt).toBeNull()
  })

  it('sets paidAt to null when transitioning to overdue', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    await updatePaymentStatusAction(makeFormData({ paymentId: 'pay-1', status: 'overdue' }))
    const setArgs = mockSet.mock.calls[0][0] as Record<string, unknown>
    expect(setArgs.paidAt).toBeNull()
  })

  it('returns { success: true } on happy path', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    const result = await updatePaymentStatusAction(
      makeFormData({ paymentId: 'pay-1', status: 'paid' }),
    )
    expect(result).toEqual({ success: true })
  })
})
