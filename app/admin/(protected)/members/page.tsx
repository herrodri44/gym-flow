// Auth lives in the layout; all data fetching is in lib/domain/members-list.ts.
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getMembersList } from '@/lib/domain/members-list'
import type { MembersListFilters } from '@/lib/domain/members-list'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CreateMemberDialog } from './_components/create-member-dialog'
import { MemberActionsMenu } from './_components/member-actions-menu'

function buildPageUrl(q: string, status: string, payment: string, page: number) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status && status !== 'active') params.set('status', status)
  if (payment && payment !== 'all') params.set('payment', payment)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return `/admin/members${qs ? '?' + qs : ''}`
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatDateTime(ts: Date | string | null) {
  if (!ts) return '—'
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return (
    d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  )
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const filters: MembersListFilters = {
    q: typeof sp.q === 'string' ? sp.q.trim() : '',
    status: (typeof sp.status === 'string' ? sp.status : 'active') as MembersListFilters['status'],
    payment: (typeof sp.payment === 'string' ? sp.payment : 'all') as MembersListFilters['payment'],
    page: Math.max(1, Number(typeof sp.page === 'string' ? sp.page : '1') || 1),
  }

  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const { rows, total, totalPages } = await getMembersList(gymId, filters)

  const hasFilters = filters.q || filters.status !== 'active' || filters.payment !== 'all'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Socios</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {total} {total === 1 ? 'socio' : 'socios'}
          </p>
        </div>
        <CreateMemberDialog />
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 font-medium">Estado</label>
          <select
            name="status"
            defaultValue={filters.status}
            className="rounded-md border px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 font-medium">Cuota</label>
          <select
            name="payment"
            defaultValue={filters.payment}
            className="rounded-md border px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="all">Todas</option>
            <option value="paid">Al día</option>
            <option value="pending">Pendiente</option>
            <option value="overdue">Vencida</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 font-medium">Buscar</label>
          <div className="flex gap-2">
            <Input
              name="q"
              defaultValue={filters.q}
              placeholder="Nombre o documento…"
              className="w-56"
            />
            <Button type="submit" variant="outline" size="sm">Filtrar</Button>
            {hasFilters && (
              <Link
                href="/admin/members"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
              >
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-zinc-500">
            {filters.q ? 'Sin resultados para la búsqueda.' : 'No hay socios en esta categoría.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>F. nacimiento</TableHead>
                <TableHead>F. alta</TableHead>
                <TableHead>Último fichaje</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-center">Créditos</TableHead>
                <TableHead className="text-center">Pago</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((member) => (
                <TableRow key={member.id} className={member.active === 'false' ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">{member.fullName}</TableCell>
                  <TableCell className="text-zinc-500">{member.documentNumber}</TableCell>
                  <TableCell className="text-zinc-500">{member.phone ?? '—'}</TableCell>
                  <TableCell className="text-zinc-500">{formatDate(member.birthDate)}</TableCell>
                  <TableCell className="text-zinc-500">{formatDate(member.joinedAt)}</TableCell>
                  <TableCell className="text-zinc-500">{formatDateTime(member.lastVisit)}</TableCell>
                  <TableCell>
                    {member.enrollment ? (
                      <Badge variant="secondary">{member.enrollment.planName}</Badge>
                    ) : (
                      <span className="text-sm text-zinc-400">Sin plan</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {member.enrollment?.planType === 'unlimited' ? (
                      <span className="text-sm text-zinc-400">∞</span>
                    ) : member.availableCredits != null ? (
                      <span
                        className={cn(
                          'font-medium tabular-nums',
                          member.availableCredits <= 0
                            ? 'text-red-600'
                            : member.availableCredits <= 2
                              ? 'text-yellow-600'
                              : 'text-green-600'
                        )}
                      >
                        {member.availableCredits}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {member.enrollment ? (
                      <Badge variant={member.hasPaid ? 'default' : 'destructive'}>
                        {member.hasPaid ? 'Pagado' : 'Pendiente'}
                      </Badge>
                    ) : (
                      <span className="text-zinc-400 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <MemberActionsMenu
                      member={{
                        id: member.id,
                        fullName: member.fullName,
                        documentNumber: member.documentNumber,
                        phone: member.phone,
                        email: member.email,
                        birthDate: member.birthDate,
                        joinedAt: member.joinedAt,
                        active: member.active,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>Página {filters.page} de {totalPages}</span>
          <div className="flex gap-2">
            {filters.page > 1 && (
              <Link
                href={buildPageUrl(filters.q, filters.status, filters.payment, filters.page - 1)}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Anterior
              </Link>
            )}
            {filters.page < totalPages && (
              <Link
                href={buildPageUrl(filters.q, filters.status, filters.payment, filters.page + 1)}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Siguiente
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
