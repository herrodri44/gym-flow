import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/(auth)/login/actions'
import { FooterLegal } from '@/components/footer-legal'

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
    <div className="min-h-svh bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[#274060] bg-[#1B2845]">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <span className="font-bold tracking-tight text-white">GymDex</span>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-[#C8D8E8] hover:text-white">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-6 flex-1">
        {children}
      </main>
      <FooterLegal />
    </div>
  )
}
