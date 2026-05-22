'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function acceptTermsAction(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'gym_admin') {
    redirect('/login')
  }

  await db
    .update(profiles)
    .set({ termsAcceptedAt: new Date() })
    .where(eq(profiles.id, user.id))

  redirect('/admin/dashboard')
}
