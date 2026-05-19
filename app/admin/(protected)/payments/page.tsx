// Auth lives in the layout; all data fetching is in lib/domain/payments.ts.
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { formatARS } from '@/lib/utils'
import { getPaymentsPageData } from '@/lib/domain/payments'
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

function formatPeriod(ts: Date | null) {
  if (!ts) return '—'
  return ts.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

function formatDate(ts: Date | null) {
  if (!ts) return '—'
  return ts.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; month?: string }>
}) {
  const sp = await searchParams
  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const { payments, activeMembers, pendingOverdue } = await getPaymentsPageData(gymId, {
    status: sp.status,
    month: sp.month,
  })

  const hasFilters = !!sp.status || !!sp.month

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
          defaultValue={sp.status ?? ''}
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
          defaultValue={sp.month ?? ''}
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
                    {formatPeriod(p.periodStart)}
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
                    {formatDate(p.paidAt)}
                  </TableCell>
                  <TableCell className="text-zinc-400 max-w-50 truncate">
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
