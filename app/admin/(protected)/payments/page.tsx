// Auth lives in the layout; all data fetching is in lib/domain/payments.ts.
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { getPaymentsPageData } from '@/lib/domain/payments'
import { formatARS } from '@/lib/utils'
import { RegisterPaymentDialog } from './_components/register-payment-dialog'
import { PaymentsTable } from './_components/payments-table'

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const sp = await searchParams
  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const { payments, totalCollected, month, today, members, plans } = await getPaymentsPageData(gymId, {
    month: sp.month,
  })

  const isCurrentMonth = month === today.slice(0, 7)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pagos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {payments.length} {payments.length === 1 ? 'pago' : 'pagos'} · {formatARS(totalCollected)} cobrado
          </p>
        </div>
        <RegisterPaymentDialog members={members} plans={plans} today={today} />
      </div>

      <form className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="month"
          name="month"
          defaultValue={month}
          max={today.slice(0, 7)}
          className="input input-bordered input-sm w-full sm:w-auto bg-white text-zinc-800"
        />
        <div className="flex gap-2">
          <button type="submit" className="btn btn-sm btn-neutral flex-1 sm:flex-none">
            Ver mes
          </button>
          {!isCurrentMonth && (
            <Link href="/admin/payments" className="btn btn-sm btn-ghost flex-1 sm:flex-none">
              Mes actual
            </Link>
          )}
        </div>
      </form>

      {payments.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-zinc-500">No hay pagos registrados en este mes.</p>
          {isCurrentMonth && (
            <p className="mt-1 text-sm text-zinc-400">Registrá un pago con el botón de arriba.</p>
          )}
        </div>
      ) : (
        <PaymentsTable payments={payments} />
      )}
    </div>
  )
}
