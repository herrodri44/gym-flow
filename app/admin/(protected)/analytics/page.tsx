// Auth lives in the layout; all data fetching is in lib/domain/analytics.ts.
import { cookies } from 'next/headers'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { getAnalyticsData } from '@/lib/domain/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DailyVisitsChart } from './_components/daily-visits-chart'
import { HeatmapChart } from './_components/heatmap-chart'
import { PaymentsTrendChart } from './_components/payments-trend-chart'

export default async function AnalyticsPage() {
  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const { dailyVisits, heatmap, paymentsTrend } = await getAnalyticsData(gymId)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Analíticas</h1>
        <p className="mt-1 text-sm text-zinc-500">Tendencias de asistencia y pagos del gym</p>
      </div>

      {/* Daily visits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-600">
            Visitas por día — últimos 30 días
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DailyVisitsChart data={dailyVisits} />
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-600">
            Mapa de calor — día y hora de visita (últimas 12 semanas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HeatmapChart data={heatmap} />
        </CardContent>
      </Card>

      {/* Payments trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-600">
            Tendencia de pagos por mes — últimos 12 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentsTrendChart data={paymentsTrend} />
        </CardContent>
      </Card>
    </div>
  )
}
