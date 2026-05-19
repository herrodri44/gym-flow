import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME, type UserRole } from '@/lib/auth/roles'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.app_metadata?.role as UserRole | undefined
  redirect(role ? ROLE_HOME[role] : '/login')
}
