import { cookies } from 'next/headers'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/lib/db/client'
import { paymentRecords, members, enrollments, membershipPlans } from '@/lib/db/schema'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { formatARS } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RegisterPaymentDialog } from './_components/register-payment-dialog'
import { PaymentRowActions } from './_components/payment-row-actions'
import { MarkOverdueButton } from './_components/mark-overdue-button'

const statusVariant = {
  paid: 'default',
  pending: 'secondary',
  overdue: 'destructive',
} as const

const statusLabel = {
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
}

function formatPeriod(ts: Date | string | null) {
  if (!ts) return '—'
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

function formatDate(ts: Date | string | null) {
  if (!ts) return '—'
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; month?: string }>
}) {
  const { status: filterStatus, month: filterMonth } = await searchParams

  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const conditions = [eq(paymentRecords.gymId, gymId)]

  const validStatuses = ['paid', 'pending', 'overdue'] as const
  if (filterStatus && validStatuses.includes(filterStatus as (typeof validStatuses)[number])) {
    conditions.push(eq(paymentRecords.status, filterStatus as (typeof validStatuses)[number]))
  }

  if (filterMonth && /^\d{4}-\d{2}$/.test(filterMonth)) {
    const [y, m] = filterMonth.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0, 23, 59, 59)
    conditions.push(gte(paymentRecords.periodStart, start))
    conditions.push(lte(paymentRecords.periodStart, end))
  }

  const [payments, activeMembers] = await Promise.all([
    db
      .select({
        id: paymentRecords.id,
        amountArs: paymentRecords.amountArs,
        status: paymentRecords.status,
        periodStart: paymentRecords.periodStart,
        paidAt: paymentRecords.paidAt,
        notes: paymentRecords.notes,
        memberName: members.fullName,
        memberId: members.id,
        periodEnd: paymentRecords.periodEnd,
      })
      .from(paymentRecords)
      .innerJoin(members, eq(members.id, paymentRecords.memberId))
      .where(and(...conditions))
      .orderBy(desc(paymentRecords.periodStart), members.fullName),

    db
      .select({
        id: members.id,
        fullName: members.fullName,
        documentNumber: members.documentNumber,
        enrollmentId: enrollments.id,
        planName: membershipPlans.name,
        priceArs: membershipPlans.priceArs,
      })
      .from(members)
      .leftJoin(
        enrollments,
        and(
          eq(enrollments.memberId, members.id),
          eq(enrollments.active, 'true'),
          eq(enrollments.gymId, gymId)
        )
      )
      .leftJoin(membershipPlans, eq(membershipPlans.id, enrollments.planId))
      .where(and(eq(members.gymId, gymId), eq(members.active, 'true')))
      .orderBy(members.fullName),
  ])

  const pendingOverdue = payments.filter(
    (p) => p.status === 'pending' && new Date(p.periodEnd as Date) < new Date()
  ).length

  const hasFilters = !!filterStatus || !!filterMonth

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pagos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {payments.length} {payments.length === 1 ? 'registro' : 'registros'}
            {pendingOverdue > 0 && (
              <span className="ml-2 text-red-600">
                · {pendingOverdue} {pendingOverdue === 1 ? 'vencido por marcar' : 'vencidos por marcar'}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {pendingOverdue > 0 && <MarkOverdueButton count={pendingOverdue} />}
          <RegisterPaymentDialog members={activeMembers} />
        </div>
      </div>

      {/* Filters */}
      <form className="flex gap-3 flex-wrap items-center">
        <select
          name="status"
          defaultValue={filterStatus ?? ''}
          className="rounded-md border px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
        >
          <option value="">Todos los estados</option>
          <option value="paid">Pagados</option>
          <option value="pending">Pendientes</option>
          <option value="overdue">Vencidos</option>
        </select>
        <input
          type="month"
          name="month"
          defaultValue={filterMonth ?? ''}
          className="rounded-md border px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
        <button
          type="submit"
          className="rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-zinc-50"
        >
          Filtrar
        </button>
        {hasFilters && (
          <Link
            href="/admin/payments"
            className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-800"
          >
            Limpiar
          </Link>
        )}
      </form>

      {payments.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-zinc-500">
            {hasFilters ? 'No hay pagos con ese filtro.' : 'No hay pagos registrados.'}
          </p>
          {!hasFilters && (
            <p className="mt-1 text-sm text-zinc-400">
              Registrá el primer pago usando el botón de arriba.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead>Fecha de pago</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/members/${p.memberId}`}
                      className="hover:underline"
                    >
                      {p.memberName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-600 capitalize">
                    {formatPeriod(p.periodStart as Date)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatARS(p.amountArs)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={statusVariant[p.status]}>
                      {statusLabel[p.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-500 tabular-nums">
                    {formatDate(p.paidAt as Date | null)}
                  </TableCell>
                  <TableCell className="text-zinc-400 max-w-[200px] truncate">
                    {p.notes ?? '—'}
                  </TableCell>
                  <TableCell>
                    <PaymentRowActions payment={{ id: p.id, status: p.status }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
