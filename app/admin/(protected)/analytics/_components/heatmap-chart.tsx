'use client'

import { cn } from '@/lib/utils'

interface HeatmapCell {
  weekday: number
  hour: number
  value: number
}

interface Props {
  data: HeatmapCell[]
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Hours typically relevant for a gym (6am to 10pm)
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6)

function cellColor(value: number, max: number): string {
  if (max === 0 || value === 0) return 'bg-zinc-100'
  const ratio = value / max
  if (ratio < 0.2) return 'bg-indigo-100'
  if (ratio < 0.4) return 'bg-indigo-200'
  if (ratio < 0.6) return 'bg-indigo-300'
  if (ratio < 0.8) return 'bg-indigo-400'
  return 'bg-indigo-500'
}

export function HeatmapChart({ data }: Props) {
  // Build lookup: weekday → hour → count
  const lookup = new Map<number, Map<number, number>>()
  let max = 0
  for (const cell of data) {
    if (!lookup.has(cell.weekday)) lookup.set(cell.weekday, new Map())
    lookup.get(cell.weekday)!.set(cell.hour, cell.value)
    if (cell.value > max) max = cell.value
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        {/* Hour labels */}
        <div className="flex gap-1 pb-1 pl-10">
          {HOURS.map((h) => (
            <div key={h} className="w-7 shrink-0 text-center text-[10px] text-zinc-400">
              {h}h
            </div>
          ))}
        </div>

        {/* Rows: one per weekday */}
        <div className="flex flex-col gap-1">
          {WEEKDAYS.map((day, wi) => (
            <div key={wi} className="flex items-center gap-1">
              <span className="w-9 shrink-0 text-right text-[11px] text-zinc-500 pr-1">{day}</span>
              {HOURS.map((h) => {
                const v = lookup.get(wi)?.get(h) ?? 0
                return (
                  <div
                    key={h}
                    title={`${day} ${h}:00 — ${v} ${v === 1 ? 'visita' : 'visitas'}`}
                    className={cn('h-7 w-7 shrink-0 rounded', cellColor(v, max))}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 pt-3 pl-10">
          <span className="text-[10px] text-zinc-400">Menos</span>
          {[0, 0.2, 0.4, 0.6, 0.8].map((ratio, i) => (
            <div key={i} className={cn('h-4 w-4 rounded', cellColor(ratio * max || (i === 0 ? 0 : 1), max))} />
          ))}
          <span className="text-[10px] text-zinc-400">Más</span>
        </div>
      </div>
    </div>
  )
}
