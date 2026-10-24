'use client'

import Link from 'next/link'
import { formatARS } from '@/lib/utils'
import { addDays } from '@/lib/domain/period-math'
import { formatDay } from '@/lib/standing-ui'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaymentRowActions } from './payment-row-actions'
import type { PaymentRow } from '@/lib/domain/payments'

function periodLabel(p: PaymentRow) {
  if (!p.startDate || !p.endDate) return 'Sin período'
  return `${formatDay(p.startDate)} → ${formatDay(addDays(p.endDate, -1))}`
}

export function PaymentsTable({ payments }: { payments: PaymentRow[] }) {
  return (
    <div className="space-y-2">
      {/* Mobile: card list */}
      <div className="sm:hidden space-y-2">
        {payments.map((p) => (
          <div key={p.id} className="rounded-lg border bg-white px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/admin/members/${p.memberId}`} className="block truncate text-sm font-medium hover:underline">
                  {p.memberName}
                </Link>
                <p className="mt-0.5 text-xs text-zinc-500">{p.planName ?? '—'} · {periodLabel(p)}</p>
              </div>
              <PaymentRowActions paymentId={p.id} memberId={p.memberId} />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold tabular-nums">{formatARS(p.amountArs)}</span>
              <span className="text-xs text-zinc-500">Pagó {formatDay(p.paidOn)}</span>
            </div>
            {p.notes && <p className="truncate text-xs text-zinc-400">{p.notes}</p>}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block rounded-lg border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha de pago</TableHead>
              <TableHead>Socio</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-zinc-500 tabular-nums">{formatDay(p.paidOn)}</TableCell>
                <TableCell className="font-medium">
                  <Link href={`/admin/members/${p.memberId}`} className="hover:underline">
                    {p.memberName}
                  </Link>
                </TableCell>
                <TableCell className="text-zinc-600">{p.planName ?? '—'}</TableCell>
                <TableCell className="text-zinc-600 tabular-nums">{periodLabel(p)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatARS(p.amountArs)}</TableCell>
                <TableCell className="text-zinc-400 max-w-50 truncate">{p.notes ?? '—'}</TableCell>
                <TableCell>
                  <PaymentRowActions paymentId={p.id} memberId={p.memberId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
