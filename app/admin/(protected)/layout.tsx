// Auth check and gym validation live here; data fetching is in lib/domain/admin.ts.
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { getAdminLayoutData } from '@/lib/domain/admin'
import { AdminNavbar } from '@/components/admin/navbar'
import { FooterLegal } from '@/components/footer-legal'

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const activeGymId = cookieStore.get(ACTIVE_GYM_COOKIE)?.value
  if (!activeGymId) redirect('/admin/select-gym')

  const layoutData = await getAdminLayoutData(user.id, activeGymId)
  if (!layoutData) redirect('/admin/select-gym')

  // First-time login: force terms acceptance before accessing the app
  if (!layoutData.termsAcceptedAt) redirect('/admin/accept-terms')

  const userName = user.user_metadata?.full_name ?? user.email ?? 'Admin'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminNavbar
        userName={userName}
        userEmail={user.email ?? ''}
        gymName={layoutData.gymName}
        hasMultipleGyms={layoutData.hasMultipleGyms}
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 flex-1">
        {children}
      </main>
      <FooterLegal />
    </div>
  )
}
