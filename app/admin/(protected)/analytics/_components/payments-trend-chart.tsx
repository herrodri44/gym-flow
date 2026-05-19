'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts'
import { formatARS } from '@/lib/utils'

interface Props {
  data: { label: string; collected: number; pending: number }[]
}

function formatK(value: number): string {
  if (value === 0) return '0'
  const n = value / 100  // centavos → pesos
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${n}`
}

export function PaymentsTrendChart({ data }: Props) {
  const chartData = data.map((d) => ({
    name: d.label,
    Cobrado: d.collected,
    Pendiente: d.pending,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={formatK}
        />
        <Tooltip
          formatter={(value, name) => [formatARS(Number(value ?? 0)), String(name)]}
          cursor={{ fill: '#f4f4f5' }}
        />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Cobrado" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={20} />
        <Bar dataKey="Pendiente" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}
