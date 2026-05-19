// Auth lives here; data fetching is in lib/domain/admin.ts.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAssignedGyms } from '@/lib/domain/admin'
import { selectGymAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default async function SelectGymPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const assignedGyms = await getAssignedGyms(user.id)

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Gym Flow</h1>
          <p className="mt-2 text-zinc-500">Elegí el gimnasio con el que querés trabajar</p>
        </div>

        <div className="space-y-3">
          {assignedGyms.map((gym) => (
            <form key={gym.id} action={selectGymAction}>
              <input type="hidden" name="gymId" value={gym.id} />
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{gym.name}</p>
                    <p className="text-sm text-zinc-400">{gym.timezone}</p>
                  </div>
                  <Button type="submit" variant="ghost" size="sm">
                    Entrar →
                  </Button>
                </CardContent>
              </Card>
            </form>
          ))}

          {assignedGyms.length === 0 && (
            <div className="rounded-lg border border-dashed py-12 text-center">
              <p className="text-zinc-500">No tenés gimnasios asignados.</p>
              <p className="mt-1 text-sm text-zinc-400">
                Contactá al Superadministrador.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
