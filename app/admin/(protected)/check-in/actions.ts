'use server'

import { cookies } from 'next/headers'
import { db } from '@/lib/db/client'
import { gyms, gymAdmins, members } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import {
  validateFichaje,
  validateMemberFichaje,
  recordVisit,
  type FichajeResult,
} from '@/lib/domain/fichaje'

type ErrorResult = { status: 'error'; message: string }
type RegisteredResult = {
  status: 'registered'
  wasOverLimit: boolean
  memberName: string
  creditsLeft: number | null
}

async function getAdminContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'gym_admin') return null

  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)?.value
  if (!gymId) return null

  const [assignment] = await db
    .select({ id: gymAdmins.id })
    .from(gymAdmins)
    .where(and(eq(gymAdmins.gymId, gymId), eq(gymAdmins.userId, user.id)))
    .limit(1)

  if (!assignment) return null

  const [gym] = await db
    .select({ id: gyms.id, timezone: gyms.timezone })
    .from(gyms)
    .where(eq(gyms.id, gymId))
    .limit(1)

  if (!gym) return null
  return { user, gymId: gym.id, gymTimezone: gym.timezone }
}

// Search and validate — no side effects. Use to preview result before registering.
export async function searchFichajeAction(
  query: string,
): Promise<FichajeResult | ErrorResult> {
  const ctx = await getAdminContext()
  if (!ctx) return { status: 'error', message: 'No autorizado' }

  return validateFichaje(query, ctx.gymId, ctx.gymTimezone, 'fichaje_admin')
}

// Validate a specific member by ID — no side effects. Use after selecting from multiple_matches.
export async function validateMemberFichajeAction(
  memberId: string,
): Promise<Exclude<FichajeResult, { status: 'multiple_matches' } | { status: 'not_found' }> | ErrorResult> {
  const ctx = await getAdminContext()
  if (!ctx) return { status: 'error', message: 'No autorizado' }

  const [member] = await db
    .select({
      id: members.id,
      fullName: members.fullName,
      documentNumber: members.documentNumber,
    })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.gymId, ctx.gymId)))
    .limit(1)

  if (!member) return { status: 'error', message: 'Socio no encontrado' }

  return validateMemberFichaje(member, ctx.gymId, ctx.gymTimezone)
}

// Validate again and register the visit atomically.
export async function registerFichajeAction(
  memberId: string,
): Promise<RegisteredResult | Exclude<FichajeResult, { status: 'ok' | 'over_limit_allowed' | 'multiple_matches' | 'not_found' }> | ErrorResult> {
  const ctx = await getAdminContext()
  if (!ctx) return { status: 'error', message: 'No autorizado' }

  const [member] = await db
    .select({
      id: members.id,
      fullName: members.fullName,
      documentNumber: members.documentNumber,
    })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.gymId, ctx.gymId)))
    .limit(1)

  if (!member) return { status: 'error', message: 'Socio no encontrado' }

  const validation = await validateMemberFichaje(member, ctx.gymId, ctx.gymTimezone)

  if (validation.status === 'ok') {
    await recordVisit(memberId, ctx.gymId, 'fichaje_admin', false, ctx.user.id)
    return {
      status: 'registered',
      wasOverLimit: false,
      memberName: member.fullName,
      creditsLeft: validation.creditsLeft,
    }
  }

  if (validation.status === 'over_limit_allowed') {
    await recordVisit(memberId, ctx.gymId, 'fichaje_admin', true, ctx.user.id)
    return {
      status: 'registered',
      wasOverLimit: true,
      memberName: member.fullName,
      creditsLeft: null,
    }
  }

  return validation
}
