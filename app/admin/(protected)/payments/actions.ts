'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { db } from '@/lib/db/client'
import { paymentRecords, gymAdmins } from '@/lib/db/schema'
import { and, eq, lt, sql } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { pesosTocentavos } from '@/lib/utils'

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'gym_admin') return null

  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)?.value
  if (!gymId) return null

  const [assignment] = await db
    .select({ id: gymAdmins.id })
    .from(gymAdmins)
    .where(and(eq(gymAdmins.gymId, gymId), eq(gymAdmins.userId, user.id)))
    .limit(1)

  if (!assignment) return null
  return { user, gymId }
}

export async function registerPaymentAction(formData: FormData) {
  const ctx = await getAuthContext()
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

  revalidatePath('/admin/payments')
  return { success: true }
}

export async function updatePaymentStatusAction(formData: FormData) {
  const ctx = await getAuthContext()
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
  const ctx = await getAuthContext()
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
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'No autorizado' }

  const paymentId = formData.get('paymentId') as string
  if (!paymentId) return { error: 'ID inválido' }

  await db
    .delete(paymentRecords)
    .where(and(eq(paymentRecords.id, paymentId), eq(paymentRecords.gymId, ctx.gymId)))

  revalidatePath('/admin/payments')
  return { success: true }
}
