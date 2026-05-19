import { cookies } from 'next/headers'
import Link from 'next/link'
import { and, asc, count, eq, exists, ilike, inArray, or, gte, lte, max, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { gyms, members, enrollments, membershipPlans, visits, paymentRecords } from '@/lib/db/schema'
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

const PAGE_SIZE = 25

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
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const status = typeof sp.status === 'string' ? sp.status : 'active'
  const payment = typeof sp.payment === 'string' ? sp.payment : 'all'
  const page = Math.max(1, Number(typeof sp.page === 'string' ? sp.page : '1') || 1)

  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const [gym] = await db
    .select({ timezone: gyms.timezone })
    .from(gyms)
    .where(eq(gyms.id, gymId))
    .limit(1)

  const gymTimezone = gym?.timezone ?? 'America/Argentina/Buenos_Aires'

  const searchFilter = q
    ? or(ilike(members.fullName, `%${q}%`), ilike(members.documentNumber, `%${q}%`))
    : undefined

  const statusFilter =
    status === 'inactive'
      ? eq(members.active, 'false')
      : status === 'all'
        ? undefined
        : eq(members.active, 'true')

  const validPaymentStatuses = ['paid', 'pending', 'overdue'] as const
  type PaymentStatus = (typeof validPaymentStatuses)[number]
  const paymentFilter =
    validPaymentStatuses.includes(payment as PaymentStatus)
      ? exists(
          db
            .select({ x: sql`1` })
            .from(paymentRecords)
            .where(
              and(
                eq(paymentRecords.memberId, members.id),
                eq(paymentRecords.gymId, gymId),
                eq(paymentRecords.status, payment as PaymentStatus),
                lte(paymentRecords.periodStart, sql`now()`),
                gte(paymentRecords.periodEnd, sql`now()`)
              )
            )
        )
      : undefined

  const baseWhere = and(eq(members.gymId, gymId), statusFilter, searchFilter, paymentFilter)

  const [{ total }] = await db.select({ total: count() }).from(members).where(baseWhere)

  const memberRows = await db
    .select({
      id: members.id,
      fullName: members.fullName,
      documentNumber: members.documentNumber,
      phone: members.phone,
      email: members.email,
      birthDate: members.birthDate,
      joinedAt: members.joinedAt,
      active: members.active,
    })
    .from(members)
    .where(baseWhere)
    .orderBy(asc(members.fullName))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)

  const memberIds = memberRows.map((r) => r.id)

  const [enrollmentRows, visitCountRows, lastVisitRows, paidMemberRows] =
    memberIds.length > 0
      ? await Promise.all([
          // Active plan for each member
          db
            .select({
              memberId: enrollments.memberId,
              planName: membershipPlans.name,
              planType: membershipPlans.planType,
              creditsPerMonth: membershipPlans.creditsPerMonth,
            })
            .from(enrollments)
            .innerJoin(membershipPlans, eq(membershipPlans.id, enrollments.planId))
            .where(
              and(
                inArray(enrollments.memberId, memberIds),
                eq(enrollments.gymId, gymId),
                eq(enrollments.active, 'true')
              )
            ),

          // Visit count this calendar month (excluding over_limit)
          db
            .select({ memberId: visits.memberId, n: count() })
            .from(visits)
            .where(
              and(
                inArray(visits.memberId, memberIds),
                eq(visits.gymId, gymId),
                eq(visits.overLimit, 'false'),
                gte(
                  visits.visitedAt,
                  sql`(date_trunc('month', now() AT TIME ZONE ${gymTimezone}) AT TIME ZONE ${gymTimezone})`
                )
              )
            )
            .groupBy(visits.memberId),

          // Last check-in per member
          db
            .select({ memberId: visits.memberId, lastVisit: max(visits.visitedAt) })
            .from(visits)
            .where(and(inArray(visits.memberId, memberIds), eq(visits.gymId, gymId)))
            .groupBy(visits.memberId),

          // Members with a paid record covering today
          db
            .selectDistinct({ memberId: paymentRecords.memberId })
            .from(paymentRecords)
            .where(
              and(
                inArray(paymentRecords.memberId, memberIds),
                eq(paymentRecords.gymId, gymId),
                eq(paymentRecords.status, 'paid'),
                lte(paymentRecords.periodStart, sql`now()`),
                gte(paymentRecords.periodEnd, sql`now()`)
              )
            ),
        ])
      : [[], [], [], []]

  const enrollMap = new Map(enrollmentRows.map((e) => [e.memberId, e]))
  const visitMap = new Map(visitCountRows.map((v) => [v.memberId, Number(v.n)]))
  const lastVisitMap = new Map(lastVisitRows.map((v) => [v.memberId, v.lastVisit]))
  const paidSet = new Set(paidMemberRows.map((r) => r.memberId))

  const totalPages = Math.ceil(Number(total) / PAGE_SIZE)

  const hasFilters = q || status !== 'active' || payment !== 'all'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Socios</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {total} {Number(total) === 1 ? 'socio' : 'socios'}
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
            defaultValue={status}
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
            defaultValue={payment}
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
              defaultValue={q}
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

      {memberRows.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-zinc-500">
            {q ? 'Sin resultados para la búsqueda.' : 'No hay socios en esta categoría.'}
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
              {memberRows.map((member) => {
                const enrollment = enrollMap.get(member.id)
                const usedCredits = visitMap.get(member.id) ?? 0
                const lastVisit = lastVisitMap.get(member.id) ?? null
                const hasPaid = paidSet.has(member.id)
                const isUnlimited = enrollment?.planType === 'unlimited'
                const availableCredits =
                  enrollment != null && !isUnlimited
                    ? (enrollment.creditsPerMonth ?? 0) - usedCredits
                    : null

                return (
                  <TableRow key={member.id} className={member.active === 'false' ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{member.fullName}</TableCell>
                    <TableCell className="text-zinc-500">{member.documentNumber}</TableCell>
                    <TableCell className="text-zinc-500">{member.phone ?? '—'}</TableCell>
                    <TableCell className="text-zinc-500">{formatDate(member.birthDate)}</TableCell>
                    <TableCell className="text-zinc-500">{formatDate(member.joinedAt)}</TableCell>
                    <TableCell className="text-zinc-500">{formatDateTime(lastVisit)}</TableCell>
                    <TableCell>
                      {enrollment ? (
                        <Badge variant="secondary">{enrollment.planName}</Badge>
                      ) : (
                        <span className="text-sm text-zinc-400">Sin plan</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isUnlimited ? (
                        <span className="text-sm text-zinc-400">∞</span>
                      ) : availableCredits != null ? (
                        <span
                          className={cn(
                            'font-medium tabular-nums',
                            availableCredits <= 0
                              ? 'text-red-600'
                              : availableCredits <= 2
                                ? 'text-yellow-600'
                                : 'text-green-600'
                          )}
                        >
                          {availableCredits}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {enrollment ? (
                        <Badge variant={hasPaid ? 'default' : 'destructive'}>
                          {hasPaid ? 'Pagado' : 'Pendiente'}
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
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildPageUrl(q, status, payment, page - 1)}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildPageUrl(q, status, payment, page + 1)}
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
