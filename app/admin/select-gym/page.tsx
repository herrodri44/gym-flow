// Auth lives here; data fetching is in lib/domain/admin.ts.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAssignedGyms } from '@/lib/domain/admin'
import { selectGymAction } from './actions'
import type { AssignedGym } from '@/lib/domain/admin'

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function city(tz: string) {
  return tz.split('/').pop()?.replace(/_/g, ' ') ?? tz
}

const COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500', 'bg-rose-500']

export default async function SelectGymPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const assignedGyms = await getAssignedGyms(user.id)

  return (
    <div className="flex min-h-screen">
      {/* Left: brand panel */}
      <div className="hidden w-2/5 flex-col items-center justify-center bg-zinc-900 p-12 lg:flex">
        <div className="text-center text-white">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <span className="text-2xl font-black tracking-tight">GD</span>
          </div>
          <h1 className="text-3xl font-bold">GymDex</h1>
          <p className="mt-3 max-w-xs text-sm text-zinc-400">
            Gestión de membresías, asistencia y pagos para gimnasios
          </p>
        </div>
      </div>

      {/* Right: selection */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-8">
        <div className="w-full max-w-xs">
          <h2 className="text-xl font-bold text-zinc-900">Elegí tu gimnasio</h2>
          <p className="mb-6 mt-1 text-sm text-zinc-500">
            Podés cambiarlo desde el panel en cualquier momento.
          </p>

          <div className="space-y-2">
            {assignedGyms.map((gym: AssignedGym, i: number) => (
              <form key={gym.id} action={selectGymAction}>
                <input type="hidden" name="gymId" value={gym.id} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-left transition hover:border-zinc-400 hover:bg-zinc-50"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-sm text-white ${COLORS[i % COLORS.length]}`}>
                    {initials(gym.name)}
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900">{gym.name}</p>
                    <p className="text-xs text-zinc-400">{city(gym.timezone)}</p>
                  </div>
                </button>
              </form>
            ))}
          </div>

          {assignedGyms.length === 0 && (
            <div className="mt-8 rounded-lg border border-dashed py-12 text-center">
              <p className="text-zinc-500">No tenés gimnasios asignados.</p>
              <p className="mt-1 text-sm text-zinc-400">Contactá al Superadministrador.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
