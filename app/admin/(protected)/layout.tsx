import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db/client'
import { gyms, gymAdmins } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { AdminNavbar } from '@/components/admin/navbar'

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

  const [[activeGym], allAssigned] = await Promise.all([
    db
      .select({ id: gyms.id, name: gyms.name })
      .from(gyms)
      .innerJoin(gymAdmins, eq(gymAdmins.gymId, gyms.id))
      .where(eq(gymAdmins.userId, user.id))
      .limit(1),
    db
      .select({ id: gymAdmins.id })
      .from(gymAdmins)
      .where(eq(gymAdmins.userId, user.id)),
  ])

  if (!activeGym) redirect('/admin/select-gym')

  const userName = user.user_metadata?.full_name ?? user.email ?? 'Admin'
  const userEmail = user.email ?? ''

  return (
    <div className="min-h-screen bg-background">
      <AdminNavbar
        userName={userName}
        userEmail={userEmail}
        gymName={activeGym.name}
        hasMultipleGyms={allAssigned.length > 1}
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  )
}
