// UI helpers for member standing (client-safe: no DB imports).
import type { MemberStandingStatus } from '@/lib/db/schema'

export const STANDING_LABEL: Record<MemberStandingStatus, string> = {
  active: 'Al día',
  grace: 'En gracia',
  expired: 'Vencido',
  no_plan: 'Sin plan',
  not_started: 'Por empezar',
}

export const STANDING_TEXT_CLASS: Record<MemberStandingStatus, string> = {
  active: 'text-emerald-700',
  grace: 'text-amber-600',
  expired: 'text-red-600',
  no_plan: 'text-zinc-400',
  not_started: 'text-sky-600',
}

export const STANDING_DOT_CLASS: Record<MemberStandingStatus, string> = {
  active: 'bg-emerald-500',
  grace: 'bg-amber-400',
  expired: 'bg-red-400',
  no_plan: 'bg-zinc-300',
  not_started: 'bg-sky-400',
}

// 'YYYY-MM-DD' → 'DD/MM/YYYY' without going through Date (no timezone shifts).
export function formatDay(date: string | null | undefined): string {
  if (!date) return '—'
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}
