'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface Props {
  data: { label: string; value: number }[]
}

export function VisitsAreaChart({ data }: Props) {
  const chartData = data.map((d) => ({ name: d.label, value: d.value }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="visitsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#65AFFF" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#65AFFF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#335C81' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#335C81' }} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          formatter={(value) => [value, 'Socios únicos']}
          cursor={{ stroke: '#65AFFF', strokeWidth: 1, strokeDasharray: '4 2' }}
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #C8D8E8', borderRadius: 8 }}
          labelStyle={{ color: '#1B2845', fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#335C81"
          strokeWidth={2}
          fill="url(#visitsGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#65AFFF' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
