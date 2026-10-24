// Auth lives in the layout; all data fetching is in lib/domain/dashboard.ts.
import Link from 'next/link'
import { cookies } from 'next/headers'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { cn, formatARS } from '@/lib/utils'
import {
  getDashboardContext,
  getKpis,
  getFollowUpLists,
  getStaleMembers,
  getVisitsChartData,
  EXPIRING_SOON_DAYS,
  type FollowUpList as FollowUpListData,
  type FollowUpMember,
} from '@/lib/domain/dashboard'
import { RECENT_VISIT_DAYS, STALE_AFTER_DAYS } from '@/lib/domain/activity'
import { formatDay } from '@/lib/standing-ui'
import { PaymentBarChart } from './_components/payment-bar-chart'
import { StaleMembersDialog } from './_components/stale-members-dialog'
import { VisitsAreaChart } from './_components/visits-area-chart'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const { gymName, gymTimezone, lowCreditsThreshold } = await getDashboardContext(gymId)

  const [kpis, followUp, staleMembers, visitsChart] = await Promise.all([
    getKpis(gymId, gymTimezone, lowCreditsThreshold),
    getFollowUpLists(gymId),
    getStaleMembers(gymId),
    getVisitsChartData(gymId, gymTimezone),
  ])

  const hasFollowUp =
    followUp.lapsedComing.total + followUp.expiringSoon.total + followUp.outOfCredits.total > 0
  const hasCleanup = followUp.lapsedAway.total + staleMembers.length > 0
  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="pb-8">
      {/* Editorial header */}
      <div className="border-b-2 border-[#274060] pb-5 mb-6">
        <p className="text-xs uppercase tracking-[0.15em] sm:tracking-[0.25em] text-[#335C81] font-mono mb-1.5">{today}</p>
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-none tracking-tight text-[#1B2845]">{gymName}</h1>
        <p className="text-sm text-[#335C81] mt-2">Resumen operativo diario</p>
      </div>

      {kpis.graceVisitsToday > 0 && (
        <Link
          href="/admin/members?payment=grace"
          className="mb-5 flex items-center justify-between gap-3 rounded-2xl border-l-4 border-amber-500 bg-amber-50 px-5 py-3 transition-opacity hover:opacity-80"
        >
          <p className="text-sm text-amber-900">
            <span className="font-bold">
              Hoy {kpis.graceVisitsToday === 1 ? 'ingresó 1 socio' : `ingresaron ${kpis.graceVisitsToday} socios`} con
              la cuota vencida
            </span>{' '}
            (en gracia). Registrá su pago antes de que se les corte el acceso.
          </p>
          <span className="shrink-0 text-xs font-semibold text-amber-800">Ver →</span>
        </Link>
      )}

      {/* Follow-up — act today */}
      {hasFollowUp && (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <FollowUpList
            title="Vencidos que siguen viniendo"
            hint="Cobrales o registrá el pago si ya pagaron"
            list={followUp.lapsedComing}
            viewAllHref="/admin/members?payment=lapsed&seen=recent"
            accent="red"
            detail={(m) =>
              `${m.inGrace ? 'en gracia · ' : ''}venció hace ${m.daysSinceExpiry} d · ${lastVisitText(m)}`
            }
          />
          <FollowUpList
            title={`Vencen en ${EXPIRING_SOON_DAYS} días`}
            hint="Recordales antes de que venza"
            list={followUp.expiringSoon}
            accent="amber"
            detail={(m) =>
              `${formatDay(m.validUntil)}` + (m.creditsLeft !== null ? ` · ${m.creditsLeft} créd.` : '')
            }
          />
          <FollowUpList
            title="Sin créditos antes de vencer"
            hint="Candidatos a un plan más grande"
            list={followUp.outOfCredits}
            accent="blue"
            detail={(m) => `vence ${formatDay(m.validUntil)}`}
          />
        </div>
      )}

      {/* Follow-up — win back or clean up */}
      {hasCleanup && (
        <div className="mb-7 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FollowUpList
              title={`Vencidos sin venir (+${RECENT_VISIT_DAYS} d)`}
              hint="Ofreceles volver; si no van a volver, dalos de baja"
              list={followUp.lapsedAway}
              viewAllHref="/admin/members?payment=lapsed&seen=away"
              accent="zinc"
              detail={(m) => `venció hace ${m.daysSinceExpiry} d · ${lastVisitText(m)}`}
            />
          </div>
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#C8D8E8] bg-white px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#274060]">
                Sin actividad hace +{STALE_AFTER_DAYS} días
              </p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums text-[#1B2845]">{staleMembers.length}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Figuran como activos pero no pagan ni vienen. Inflan los totales del panel.
              </p>
            </div>
            {staleMembers.length > 0 && (
              <div>
                <StaleMembersDialog members={staleMembers} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI stat row */}
      <div className="border-y border-[#C8D8E8] py-5 mb-8">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-stretch sm:gap-y-4 sm:gap-x-0">
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
            label="Vencidos"
            value={String(kpis.lapsed)}
            sub={kpis.noPlan > 0 ? `+${kpis.noPlan} sin plan` : undefined}
            color={kpis.lapsed > 0 ? 'red' : 'green'}
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
            Cuota vigente — socios activos
          </p>
          <div className="rounded-2xl border border-[#C8D8E8] bg-card p-4 shadow-sm">
            <PaymentBarChart paid={kpis.upToDate} unpaid={kpis.lapsed + kpis.noPlan} />
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
    <div className="flex flex-col rounded-xl border border-[#C8D8E8] bg-white p-3 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-4 sm:py-0 sm:first:pl-0">
      <p className="text-xs text-[#335C81] font-medium leading-none mb-1.5">{label}</p>
      <p className={cn('text-2xl sm:text-3xl font-extrabold tabular-nums leading-none', valClass)}>{value}</p>
      {sub && <p className="text-xs text-[#335C81] mt-1">{sub}</p>}
    </div>
  )
}

function lastVisitText(m: FollowUpMember) {
  if (m.daysSinceLastVisit === null) return 'nunca vino'
  if (m.daysSinceLastVisit === 0) return 'vino hoy'
  return `vino hace ${m.daysSinceLastVisit} d`
}

function Divider() {
  return <div className="hidden sm:block w-px bg-[#C8D8E8] mx-1 self-stretch" />
}

const ACCENTS = {
  red: { box: 'border-red-500 bg-red-50', dot: 'bg-red-500', title: 'text-red-700' },
  amber: { box: 'border-amber-500 bg-amber-50', dot: 'bg-amber-500', title: 'text-amber-700' },
  blue: { box: 'border-[#335C81] bg-[#EEF2F7]', dot: 'bg-[#335C81]', title: 'text-[#274060]' },
  zinc: { box: 'border-zinc-400 bg-zinc-50', dot: 'bg-zinc-400', title: 'text-zinc-700' },
} as const

function FollowUpList({
  title,
  hint,
  list,
  viewAllHref,
  accent,
  detail,
}: {
  title: string
  hint: string
  list: FollowUpListData
  viewAllHref?: string
  accent: keyof typeof ACCENTS
  detail: (m: FollowUpMember) => string
}) {
  const a = ACCENTS[accent]
  const { members, total } = list
  return (
    <div className={cn('h-full rounded-2xl border-l-4 px-5 py-4', a.box)}>
      <div className="mb-1 flex items-center gap-2">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', a.dot)} />
        <p className={cn('text-xs font-bold uppercase tracking-wide', a.title)}>
          {title}
          {total > 0 && <span className="ml-1.5 tabular-nums">({total})</span>}
        </p>
        {viewAllHref && total > members.length && (
          <Link href={viewAllHref} className={cn('ml-auto shrink-0 text-xs font-semibold hover:underline', a.title)}>
            Ver todos →
          </Link>
        )}
      </div>
      <p className="mb-3 text-xs text-zinc-500">{hint}</p>
      {members.length === 0 ? (
        <p className="py-1.5 text-sm text-zinc-400">Nadie por ahora</p>
      ) : (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
          {members.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/members/${m.id}`}
                className="flex items-center justify-between gap-3 py-1.5 transition-opacity hover:opacity-70"
              >
                <span className="truncate text-sm font-medium text-[#1B2845]">{m.fullName}</span>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">{detail(m)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
