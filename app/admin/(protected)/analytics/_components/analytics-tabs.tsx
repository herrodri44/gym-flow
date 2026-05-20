'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { DailyVisitsChart } from './daily-visits-chart'
import { HeatmapChart } from './heatmap-chart'
import { PaymentsTrendChart } from './payments-trend-chart'
import { PlanDistributionChart } from './plan-distribution-chart'

interface AnalyticsData {
  dailyVisits: { label: string; value: number }[]
  heatmap: { weekday: number; hour: number; value: number }[]
  paymentsTrend: { label: string; collected: number; pending: number }[]
  planDistribution: { planName: string; memberCount: number }[]
}

const TABS = [
  {
    key: 'visits',
    label: 'Visitas diarias',
    sublabel: 'Últimos 30 días',
    description:
      'Muestra cuántas veces ficharon los socios cada día durante el último mes. Permite comparar semanas consecutivas y detectar caídas sostenidas en la asistencia.',
    tip: 'Un día pico seguido de una semana baja puede indicar un evento especial que trajo asistencia puntual. Cruzalo con el calendario del gym.',
  },
  {
    key: 'heatmap',
    label: 'Mapa de calor',
    sublabel: 'Últimas 12 semanas',
    description:
      'Indica en qué días y franjas horarias se concentra la asistencia durante los últimos 3 meses. Los colores más intensos señalan los momentos de mayor actividad.',
    tip: 'Usalo para diseñar el horario de clases grupales y distribuir el personal en los momentos de mayor demanda.',
  },
  {
    key: 'payments',
    label: 'Tendencia de pagos',
    sublabel: 'Últimos 12 meses',
    description:
      'Compara mes a mes cuánto se cobró (verde) versus cuánto quedó pendiente (naranja) durante el último año. Permite evaluar la efectividad de la cobranza.',
    tip: '',
  },
  {
    key: 'plans',
    label: 'Socios por plan',
    sublabel: 'Estado actual',
    description:
      'Muestra cuántos socios activos tiene cada plan en este momento. Incluye una categoría "Sin plan" para los socios activos que no tienen ninguna membresía vigente.',
    tip: '',
  },
]

export function AnalyticsTabs({ dailyVisits, heatmap, paymentsTrend, planDistribution }: AnalyticsData) {
  const [active, setActive] = useState('visits')
  const tab = TABS.find((t) => t.key === active) ?? TABS[0]

  return (
    <div className="flex min-h-130">
      {/* Vertical tab sidebar */}
      <div className="w-44 shrink-0 border-r border-zinc-200">
        <p className="px-4 pt-1 pb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          Reportes
        </p>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              'w-full text-left px-4 py-3 border-r-2 transition-colors',
              active === t.key
                ? 'border-[#335C81] bg-blue-50'
                : 'border-transparent hover:bg-zinc-50',
            )}
          >
            <p
              className={cn(
                'text-sm font-medium leading-none mb-0.5',
                active === t.key ? 'text-[#1B2845]' : 'text-zinc-600',
              )}
            >
              {t.label}
            </p>
            <p className="text-xs text-zinc-400">{t.sublabel}</p>
          </button>
        ))}
      </div>

      {/* Main panel */}
      <div className="flex-1 pl-8 pt-1">
        <h2 className="text-xl font-semibold text-zinc-900 mb-0.5">{tab.label}</h2>
        <p className="text-xs text-zinc-400 mb-5">{tab.sublabel}</p>

        <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 mb-6 max-w-2xl">
          <p className="text-sm text-zinc-700 leading-relaxed mb-2">{tab.description}</p>
          {tab.tip ? (
          <p className="text-xs text-zinc-500 leading-relaxed">
            <span className="font-semibold text-[#335C81]">Consejo: </span>
            {tab.tip}
          </p>
          ) : null}
        </div>

        <div className="max-w-3xl">
          {active === 'visits' && <DailyVisitsChart data={dailyVisits} />}
          {active === 'heatmap' && <HeatmapChart data={heatmap} />}
          {active === 'payments' && <PaymentsTrendChart data={paymentsTrend} />}
          {active === 'plans' && <PlanDistributionChart data={planDistribution} />}
        </div>
      </div>
    </div>
  )
}
