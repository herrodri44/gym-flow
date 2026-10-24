import { describe, it, expect, vi, beforeEach } from 'vitest'

// The action is a thin adapter: auth, parse, convert pesos → centavos,
// delegate. recordPayment itself (period math, transaction, visit
// attachment, tenant checks) is covered by tests/integration/billing.test.ts.

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

const mockRequireGymAdmin = vi.fn()
vi.mock('@/lib/auth/context', () => ({ requireGymAdmin: mockRequireGymAdmin }))

const mockRecordPayment = vi.fn()
const mockDeletePayment = vi.fn()
vi.mock('@/lib/domain/payments', () => ({
  recordPayment: mockRecordPayment,
  deletePayment: mockDeletePayment,
}))

const { registerPaymentAction, deletePaymentAction } = await import('@/app/admin/(protected)/payments/actions')

const AUTH_CTX = { user: { id: 'admin-1' }, gymId: 'gym-1' }
const PERIOD = { startDate: '2026-10-05', endDate: '2026-11-05', anchorDay: 5 }

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

const VALID = { memberId: 'member-1', planId: 'plan-1', amountArs: '30000' }

beforeEach(() => {
  mockRequireGymAdmin.mockReset()
  mockRecordPayment.mockReset()
  mockDeletePayment.mockReset()
})

describe('registerPaymentAction', () => {
  it('rejects unauthenticated callers without touching the domain', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(null)
    expect(await registerPaymentAction(makeFormData(VALID))).toEqual({ error: 'No autorizado' })
    expect(mockRecordPayment).not.toHaveBeenCalled()
  })

  it.each([
    [{ ...VALID, memberId: '' }, 'Seleccioná un socio'],
    [{ ...VALID, planId: '' }, 'Seleccioná un plan'],
    [{ ...VALID, amountArs: 'abc' }, 'El monto es inválido'],
    [{ ...VALID, amountArs: '-5' }, 'El monto es inválido'],
    [{ ...VALID, paymentDate: '05/10/2026' }, 'La fecha de pago es inválida'],
    [{ ...VALID, startDate: 'mañana' }, 'La fecha de inicio es inválida'],
  ])('validates input: %o → %s', async (fields, error) => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    expect(await registerPaymentAction(makeFormData(fields))).toEqual({ error })
    expect(mockRecordPayment).not.toHaveBeenCalled()
  })

  it('delegates with the session gym, amount in centavos, and optional dates', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    mockRecordPayment.mockResolvedValueOnce({ success: true, period: PERIOD })

    const result = await registerPaymentAction(
      makeFormData({ ...VALID, paymentDate: '2026-10-05', startDate: '2026-10-03', notes: ' efectivo ' }),
    )

    expect(mockRecordPayment).toHaveBeenCalledWith({
      gymId: 'gym-1',
      memberId: 'member-1',
      planId: 'plan-1',
      amountArs: 3_000_000,
      paymentDate: '2026-10-05',
      startDate: '2026-10-03',
      notes: 'efectivo',
    })
    expect(result).toEqual({ success: true, period: PERIOD })
  })

  it('omits empty dates so the domain applies its defaults', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    mockRecordPayment.mockResolvedValueOnce({ success: true, period: PERIOD })
    await registerPaymentAction(makeFormData({ ...VALID, paymentDate: '', startDate: '' }))
    expect(mockRecordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentDate: undefined, startDate: undefined, notes: null }),
    )
  })

  it('passes domain errors through unchanged', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    mockRecordPayment.mockResolvedValueOnce({ error: 'Plan no encontrado' })
    expect(await registerPaymentAction(makeFormData(VALID))).toEqual({ error: 'Plan no encontrado' })
  })

  it('never throws: unexpected errors become { error }', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    mockRecordPayment.mockRejectedValueOnce(new Error('connection reset'))
    expect(await registerPaymentAction(makeFormData(VALID))).toEqual({ error: 'No se pudo guardar el pago' })
  })
})

describe('deletePaymentAction', () => {
  it('scopes the delete to the session gym', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    mockDeletePayment.mockResolvedValueOnce({ success: true })
    expect(await deletePaymentAction(makeFormData({ paymentId: 'pay-1' }))).toEqual({ success: true })
    expect(mockDeletePayment).toHaveBeenCalledWith('gym-1', 'pay-1')
  })

  it('requires a payment id', async () => {
    mockRequireGymAdmin.mockResolvedValueOnce(AUTH_CTX)
    expect(await deletePaymentAction(makeFormData({}))).toEqual({ error: 'ID inválido' })
  })
})
