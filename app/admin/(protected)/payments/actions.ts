'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/client'
import { paymentRecords } from '@/lib/db/schema'
import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import { requireGymAdmin } from '@/lib/auth/context'
import { pesosTocentavos } from '@/lib/utils'
import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'
import { generatePaymentsForGym } from '@/lib/domain/payments'

export async function registerPaymentAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const memberId = formData.get('memberId') as string
  const enrollmentId = (formData.get('enrollmentId') as string) || null
  const amountInput = parseFloat(formData.get('amountArs') as string)
  const month = formData.get('month') as string // YYYY-MM
  const status = (formData.get('status') as 'paid' | 'pending') ?? 'paid'
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!memberId) return { error: 'Seleccioná un socio' }
  if (isNaN(amountInput) || amountInput < 0) return { error: 'El monto es inválido' }
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return { error: 'El período es inválido' }
  if (!['paid', 'pending'].includes(status)) return { error: 'Estado inválido' }

  const [year, monthNum] = month.split('-').map(Number)
  const periodStart = new Date(year, monthNum - 1, 1)
  const periodEnd = new Date(year, monthNum, 0, 23, 59, 59)

  try {
    await db.insert(paymentRecords).values({
      gymId: ctx.gymId,
      memberId,
      enrollmentId: enrollmentId || null,
      amountArs: pesosTocentavos(amountInput),
      currency: 'ARS',
      periodStart,
      periodEnd,
      status,
      paidAt: status === 'paid' ? new Date() : null,
      notes,
    })
  } catch (err) {
    Sentry.captureException(err, { extra: { gymId: ctx.gymId, action: 'registerPayment' } })
    logger.error(err as Error, { gymId: ctx.gymId, action: 'registerPayment' })
    return { error: 'No se pudo guardar el pago' }
  }

  revalidatePath('/admin/payments')
  return { success: true }
}

export async function updatePaymentStatusAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const paymentId = formData.get('paymentId') as string
  const newStatus = formData.get('status') as 'paid' | 'pending' | 'overdue'

  if (!paymentId || !['paid', 'pending', 'overdue'].includes(newStatus)) {
    return { error: 'Datos inválidos' }
  }

  await db
    .update(paymentRecords)
    .set({
      status: newStatus,
      paidAt: newStatus === 'paid' ? new Date() : null,
    })
    .where(and(eq(paymentRecords.id, paymentId), eq(paymentRecords.gymId, ctx.gymId)))

  revalidatePath('/admin/payments')
  return { success: true }
}

export async function markOverdueAction() {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  await db
    .update(paymentRecords)
    .set({ status: 'overdue' })
    .where(
      and(
        eq(paymentRecords.gymId, ctx.gymId),
        eq(paymentRecords.status, 'pending'),
        lt(paymentRecords.periodEnd, sql`now()`)
      )
    )

  revalidatePath('/admin/payments')
  return { success: true }
}

export async function deletePaymentAction(formData: FormData) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }

  const paymentId = formData.get('paymentId') as string
  if (!paymentId) return { error: 'ID inválido' }

  await db
    .delete(paymentRecords)
    .where(and(eq(paymentRecords.id, paymentId), eq(paymentRecords.gymId, ctx.gymId)))

  revalidatePath('/admin/payments')
  return { success: true }
}

export async function generatePaymentsAction(month: string) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return { error: 'Mes inválido' }

  const { created } = await generatePaymentsForGym(ctx.gymId, month)
  revalidatePath('/admin/payments')
  return { success: true, created }
}

export async function bulkUpdateStatusAction(
  ids: string[],
  status: 'paid' | 'pending' | 'overdue',
) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }
  if (!ids.length) return { error: 'Sin registros seleccionados' }

  await db
    .update(paymentRecords)
    .set({ status, paidAt: status === 'paid' ? new Date() : null })
    .where(and(inArray(paymentRecords.id, ids), eq(paymentRecords.gymId, ctx.gymId)))

  revalidatePath('/admin/payments')
  return { success: true }
}

export async function bulkDeleteAction(ids: string[]) {
  const ctx = await requireGymAdmin()
  if (!ctx) return { error: 'No autorizado' }
  if (!ids.length) return { error: 'Sin registros seleccionados' }

  await db
    .delete(paymentRecords)
    .where(and(inArray(paymentRecords.id, ids), eq(paymentRecords.gymId, ctx.gymId)))

  revalidatePath('/admin/payments')
  return { success: true }
}
