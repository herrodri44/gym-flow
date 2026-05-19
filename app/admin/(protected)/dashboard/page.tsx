// Auth lives in the layout; all data fetching is in lib/domain/dashboard.ts.
import Link from 'next/link'
import { cookies } from 'next/headers'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { cn, formatARS } from '@/lib/utils'
import {
  getDashboardContext,
  getKpis,
  getUnpaidMembers,
  getVisitsChartData,
  type UnpaidMember,
} from '@/lib/domain/dashboard'
import { PaymentBarChart } from './_components/payment-bar-chart'
import { VisitsAreaChart } from './_components/visits-area-chart'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const { gymName, gymTimezone, lowCreditsThreshold } = await getDashboardContext(gymId)

  const [kpis, unpaidMembers, visitsChart] = await Promise.all([
    getKpis(gymId, gymTimezone, lowCreditsThreshold),
    getUnpaidMembers(gymId, gymTimezone),
    getVisitsChartData(gymId, gymTimezone),
  ])

  const totalUnpaid = unpaidMembers.visiting.length + unpaidMembers.absent.length
  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="pb-8">
      {/* Editorial header */}
      <div className="border-b-2 border-[#274060] pb-5 mb-6">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#335C81] font-mono mb-1.5">{today}</p>
        <h1 className="text-5xl font-extrabold leading-none tracking-tight text-[#1B2845]">{gymName}</h1>
        <p className="text-sm text-[#335C81] mt-2">Resumen operativo diario</p>
      </div>

      {/* Unpaid alerts — priority */}
      {totalUnpaid > 0 && (
        <div className="mb-7 rounded-2xl border-l-4 border-red-500 bg-red-50 px-5 py-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-600 mb-4">
            Atención requerida — {totalUnpaid} socios sin pago
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {unpaidMembers.visiting.length > 0 && (
              <UnpaidList
                title="Viniendo sin pagar"
                members={unpaidMembers.visiting}
                showVisits
                accent="orange"
              />
            )}
            {unpaidMembers.absent.length > 0 && (
              <UnpaidList
                title="Ausentes sin pagar"
                members={unpaidMembers.absent}
                showVisits={false}
                accent="red"
              />
            )}
          </div>
        </div>
      )}

      {/* KPI stat row */}
      <div className="border-y border-[#C8D8E8] py-5 mb-8">
        <div className="flex flex-wrap items-stretch gap-y-4">
          <StatItem label="Activos" value={String(kpis.activeMembers)} />
          <Divider />
          <StatItem
            label="Ficharon este mes"
            value={String(kpis.visitedThisMonth)}
            sub={`${Math.round((kpis.visitedThisMonth / Math.max(kpis.activeMembers, 1)) * 100)}% de activos`}
            color="blue"
          />
          <Divider />
          <StatItem label="Esta semana" value={String(kpis.visitedLast7Days)} color="blue" />
          <Divider />
          <StatItem label="Recaudado" value={formatARS(kpis.collectedThisMonth)} color="green" />
          <Divider />
          <StatItem
            label="Por cobrar"
            value={formatARS(kpis.pendingAmountThisMonth)}
            color={kpis.pendingAmountThisMonth > 0 ? 'red' : 'green'}
          />
          <Divider />
          <StatItem
            label="Sin créditos"
            value={String(kpis.zeroCredits)}
            sub={kpis.lowCredits > 0 ? `+${kpis.lowCredits} bajos` : undefined}
            color={kpis.zeroCredits > 0 ? 'red' : 'green'}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#335C81] mb-2">
            Pagos — mes actual
          </p>
          <div className="rounded-2xl border border-[#C8D8E8] bg-card p-4 shadow-sm">
            <PaymentBarChart paid={kpis.paidThisMonth} unpaid={kpis.unpaidThisMonth} />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#335C81] mb-2">
            Socios únicos por mes
          </p>
          <div className="rounded-2xl border border-[#C8D8E8] bg-card p-4 shadow-sm">
            <VisitsAreaChart data={visitsChart} />
          </div>
        </div>
      </div>
    </div>
  )
}

type StatColor = 'blue' | 'green' | 'red'

function StatItem({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: StatColor
}) {
  const valClass = !color
    ? 'text-[#1B2845]'
    : color === 'blue'
      ? 'text-[#335C81]'
      : color === 'green'
        ? 'text-emerald-600'
        : 'text-red-500'

  return (
    <div className="flex flex-col px-4 first:pl-0">
      <p className="text-xs text-[#335C81] font-medium leading-none mb-1.5">{label}</p>
      <p className={cn('text-3xl font-extrabold tabular-nums leading-none', valClass)}>{value}</p>
      {sub && <p className="text-xs text-[#335C81] mt-1">{sub}</p>}
    </div>
  )
}

function Divider() {
  return <div className="w-px bg-[#C8D8E8] mx-1 self-stretch" />
}

function UnpaidList({
  title,
  members,
  showVisits,
  accent,
}: {
  title: string
  members: UnpaidMember[]
  showVisits: boolean
  accent: 'red' | 'orange'
}) {
  const dotClass = accent === 'red' ? 'bg-red-500' : 'bg-orange-500'
  const titleClass = accent === 'red' ? 'text-red-700' : 'text-orange-700'

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('h-2 w-2 rounded-full shrink-0', dotClass)} />
        <p className={cn('text-xs font-bold uppercase tracking-wide', titleClass)}>{title}</p>
      </div>
      <ul className="space-y-0.5">
        {members.map((m) => (
          <li key={m.id}>
            <Link
              href={`/admin/members/${m.id}`}
              className="flex items-center justify-between py-1.5 hover:opacity-70 transition-opacity"
            >
              <span className="text-sm font-medium text-[#1B2845]">{m.fullName}</span>
              <span className="text-xs text-zinc-500 tabular-nums">
                {showVisits && m.visitsThisMonth > 0
                  ? `${m.visitsThisMonth} vis.`
                  : m.lastVisit
                    ? m.lastVisit.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                    : '—'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
