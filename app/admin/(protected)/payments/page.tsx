// Auth lives in the layout; all data fetching is in lib/domain/payments.ts.
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { getPaymentsPageData } from '@/lib/domain/payments'
import { RegisterPaymentDialog } from './_components/register-payment-dialog'
import { MarkOverdueButton } from './_components/mark-overdue-button'
import { GeneratePaymentsButton } from './_components/generate-payments-button'
import { PaymentsTable } from './_components/payments-table'

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; month?: string }>
}) {
  const sp = await searchParams
  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const currentMonth = new Date().toISOString().slice(0, 7)
  const effectiveMonth = sp.month ?? currentMonth

  const { payments, activeMembers, pendingOverdue, autoGeneratePayments } =
    await getPaymentsPageData(gymId, { status: sp.status, month: effectiveMonth })

  const hasFilters = !!sp.status || !!sp.month

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
        <div className="flex flex-wrap gap-2">
          {pendingOverdue > 0 && <MarkOverdueButton count={pendingOverdue} />}
          <GeneratePaymentsButton autoGeneratePayments={autoGeneratePayments} selectedMonth={effectiveMonth} />
          <RegisterPaymentDialog members={activeMembers} />
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="select select-bordered select-sm w-full sm:w-auto bg-white text-zinc-800"
        >
          <option value="">Todos los estados</option>
          <option value="paid">Pagados</option>
          <option value="pending">Pendientes</option>
          <option value="overdue">Vencidos</option>
        </select>
        <input
          type="month"
          name="month"
          defaultValue={sp.month ?? currentMonth}
          className="input input-bordered input-sm w-full sm:w-auto bg-white text-zinc-800"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="btn btn-sm btn-neutral flex-1 sm:flex-none"
          >
            Filtrar
          </button>
          {hasFilters && (
            <Link
              href="/admin/payments"
              className="btn btn-sm btn-ghost flex-1 sm:flex-none"
            >
              Limpiar
            </Link>
          )}
        </div>
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
        <PaymentsTable payments={payments} />
      )}
    </div>
  )
}
