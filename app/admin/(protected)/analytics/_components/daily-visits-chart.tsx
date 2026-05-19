'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface Props {
  data: { label: string; value: number }[]
}

export function DailyVisitsChart({ data }: Props) {
  const chartData = data.map((d) => ({ name: d.label, value: d.value }))

  // Show every 5th tick to avoid clutter on 30-day range
  const tickIndices = new Set(chartData.map((_, i) => i).filter((i) => i % 5 === 0 || i === chartData.length - 1))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={0}
          tickFormatter={(v, i) => (tickIndices.has(i) ? v : '')}
        />
        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip
          formatter={(value) => [value, 'Visitas']}
          cursor={{ fill: '#f4f4f5' }}
        />
        <Bar dataKey="value" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}
