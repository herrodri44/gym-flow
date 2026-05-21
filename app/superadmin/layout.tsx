import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SuperadminNavbar } from '@/components/superadmin/navbar'

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'superadmin') {
    redirect('/login')
  }

  const userName = user.user_metadata?.full_name ?? user.email ?? 'Superadmin'
  const userEmail = user.email ?? ''

  return (
    <div className="min-h-svh bg-zinc-50">
      <SuperadminNavbar userName={userName} userEmail={userEmail} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  )
}
