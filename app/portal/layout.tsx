import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/(auth)/login/actions'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'member') {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <span className="font-semibold">Gym Flow</span>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-zinc-500 hover:text-zinc-900">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        {children}
      </main>
    </div>
  )
}
