'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'

interface Props {
  data: { planName: string; memberCount: number }[]
}

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#f0f0f0']

export function PlanDistributionChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-400 py-8 text-center">No hay planes activos.</p>
  }

  const maxNameLen = Math.max(...data.map((d) => d.planName.length))
  const yAxisWidth = Math.min(Math.max(maxNameLen * 7, 80), 180)
  const chartHeight = Math.max(180, data.length * 52)

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data.map((d) => ({ name: d.planName, value: d.memberCount }))}
        layout="vertical"
        margin={{ top: 4, right: 48, bottom: 4, left: 0 }}
      >
        <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={yAxisWidth}
        />
        <Tooltip
          formatter={(value) => [value, 'Socios']}
          cursor={{ fill: '#f4f4f5' }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={32}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
          <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#52525b' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
