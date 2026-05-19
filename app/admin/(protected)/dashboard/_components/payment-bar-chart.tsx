'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface Props {
  paid: number
  unpaid: number
}

const RADIAN = Math.PI / 180

function renderLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  value,
}: {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  value: number
}) {
  if (value === 0) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.52
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={18}
      fontWeight="700"
    >
      {value}
    </text>
  )
}

export function PaymentBarChart({ paid, unpaid }: Props) {
  const data = [
    { name: 'Pagaron', value: paid, color: '#335C81' },
    { name: 'Sin pago', value: unpaid, color: '#65AFFF' },
  ].filter((d) => d.value > 0)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-zinc-400">
        Sin socios con plan activo
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={82}
          dataKey="value"
          labelLine={false}
          label={renderLabel as never}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [value, 'Socios']}
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #C8D8E8', borderRadius: 8 }}
          labelStyle={{ color: '#1B2845', fontWeight: 600 }}
        />
        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12, color: '#335C81' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
