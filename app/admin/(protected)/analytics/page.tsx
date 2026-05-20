// Auth lives in the layout; all data fetching is in lib/domain/analytics.ts.
import { cookies } from 'next/headers'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { getAnalyticsData } from '@/lib/domain/analytics'
import { AnalyticsTabs } from './_components/analytics-tabs'

export default async function AnalyticsPage() {
  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const { dailyVisits, heatmap, paymentsTrend, planDistribution } = await getAnalyticsData(gymId)

  return (
    <div className="pb-8">
      <div className="border-b border-zinc-200 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Analíticas</h1>
        <p className="text-sm text-zinc-500 mt-1">Tendencias de asistencia y pagos del gimnasio</p>
      </div>
      <AnalyticsTabs dailyVisits={dailyVisits} heatmap={heatmap} paymentsTrend={paymentsTrend} planDistribution={planDistribution} />
    </div>
  )
}
