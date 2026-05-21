'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { formatARS } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaymentRowActions } from './payment-row-actions'
import { bulkUpdateStatusAction, bulkDeleteAction } from '../actions'
import type { PaymentRow } from '@/lib/domain/payments'

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

export function PaymentsTable({ payments }: { payments: PaymentRow[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const allSelected = payments.length > 0 && selectedIds.size === payments.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < payments.length

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(payments.map((p) => p.id)))
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function runBulk(fn: (ids: string[]) => Promise<unknown>) {
    startTransition(async () => {
      await fn(Array.from(selectedIds))
      setSelectedIds(new Set())
    })
  }

  return (
    <div className="space-y-2">
      {selectedIds.size > 0 && (
        <div className="hidden sm:flex items-center gap-3 rounded-lg border bg-zinc-50 px-4 py-2">
          <span className="text-sm font-medium text-zinc-700">
            {selectedIds.size} {selectedIds.size === 1 ? 'seleccionado' : 'seleccionados'}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => runBulk((ids) => bulkUpdateStatusAction(ids, 'paid'))}
            >
              Marcar pagados
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => runBulk((ids) => bulkUpdateStatusAction(ids, 'pending'))}
            >
              Marcar pendientes
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const count = selectedIds.size
                if (
                  !confirm(
                    `¿Eliminar ${count} registro${count > 1 ? 's' : ''}? Esta acción no se puede deshacer.`,
                  )
                )
                  return
                runBulk(bulkDeleteAction)
              }}
            >
              Eliminar
            </Button>
          </div>
        </div>
      )}

      {/* Mobile: card list */}
      <div className="sm:hidden space-y-2">
        {payments.map((p) => (
          <div key={p.id} className="rounded-lg border bg-white px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/admin/members/${p.memberId}`} className="block truncate text-sm font-medium hover:underline">
                  {p.memberName}
                </Link>
                <p className="mt-0.5 text-xs capitalize text-zinc-500">{formatPeriod(p.periodStart)}</p>
              </div>
              <PaymentRowActions payment={{ id: p.id, status: p.status }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold tabular-nums">{formatARS(p.amountArs)}</span>
              <Badge variant={statusVariant[p.status]}>{statusLabel[p.status]}</Badge>
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
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </TableHead>
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
              <TableRow key={p.id} data-state={selectedIds.has(p.id) ? 'selected' : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleRow(p.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/admin/members/${p.memberId}`} className="hover:underline">
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
                  <Badge variant={statusVariant[p.status]}>{statusLabel[p.status]}</Badge>
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
    </div>
  )
}
