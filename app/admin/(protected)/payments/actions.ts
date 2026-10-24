'use server'

import { revalidatePath } from 'next/cache'
import { requireGymAdmin } from '@/lib/auth/context'
import { pesosTocentavos } from '@/lib/utils'
import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'
import { deletePayment, recordPayment } from '@/lib/domain/payments'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function revalidateBilling(memberId?: string) {
  revalidatePath('/admin/payments')
  revalidatePath('/admin/members')
  revalidatePath('/admin/dashboard')
  if (memberId) revalidatePath(`/admin/members/${memberId}`)
}

export async function registerPaymentAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const memberId = (formData.get('memberId') as string | null)?.trim()
  const planId = (formData.get('planId') as string | null)?.trim()
  const amountInput = parseFloat(formData.get('amountArs') as string)
  const paymentDate = (formData.get('paymentDate') as string | null)?.trim() || undefined
  const startDate = (formData.get('startDate') as string | null)?.trim() || undefined
  const notes = (formData.get('notes') as string | null)?.trim() || null

  if (!memberId) return { error: 'Seleccioná un socio' }
  if (!planId) return { error: 'Seleccioná un plan' }
  if (isNaN(amountInput) || amountInput < 0) return { error: 'El monto es inválido' }
  if (paymentDate && !DATE_RE.test(paymentDate)) return { error: 'La fecha de pago es inválida' }
  if (startDate && !DATE_RE.test(startDate)) return { error: 'La fecha de inicio es inválida' }

  try {
    const result = await recordPayment({
      gymId: ctx.gymId,
      memberId,
      planId,
      amountArs: pesosTocentavos(amountInput),
      paymentDate,
      startDate,
      notes,
    })
    if ('error' in result) return result

    logger.info('payment.recorded', {
      gymId: ctx.gymId,
      memberId,
      periodStart: result.period.startDate,
      periodEnd: result.period.endDate,
    })
    revalidateBilling(memberId)
    return { success: true as const, period: result.period }
  } catch (err) {
    Sentry.captureException(err, { extra: { gymId: ctx.gymId, action: 'registerPayment' } })
    logger.error(err as Error, { gymId: ctx.gymId, action: 'registerPayment' })
    return { error: 'No se pudo guardar el pago' }
  }
}

export async function deletePaymentAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const paymentId = formData.get('paymentId') as string | null
  const memberId = (formData.get('memberId') as string | null) ?? undefined
  if (!paymentId) return { error: 'ID inválido' }

  try {
    const result = await deletePayment(ctx.gymId, paymentId)
    if ('error' in result) return result
    revalidateBilling(memberId)
    return { success: true as const }
  } catch (err) {
    Sentry.captureException(err, { extra: { gymId: ctx.gymId, action: 'deletePayment' } })
    logger.error(err as Error, { gymId: ctx.gymId, action: 'deletePayment' })
    return { error: 'No se pudo eliminar el pago' }
  }
}
