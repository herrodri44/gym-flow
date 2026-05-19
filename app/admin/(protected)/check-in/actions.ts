'use server'

import { db } from '@/lib/db/client'
import { gyms, members } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireGymAdmin } from '@/lib/auth/context'
import {
  validateFichaje,
  validateMemberFichaje,
  recordVisit,
  type FichajeResult,
} from '@/lib/domain/fichaje'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

type ErrorResult = { status: 'error'; message: string }
type RegisteredResult = {
  status: 'registered'
  wasOverLimit: boolean
  memberName: string
  creditsLeft: number | null
}

// Extends the base gym admin context with the gym's timezone, which is
// required for all fichaje domain functions.
async function getContext() {
  const ctx = await requireGymAdmin()
  if (!ctx) return null

  const [gym] = await db
    .select({ timezone: gyms.timezone })
    .from(gyms)
    .where(eq(gyms.id, ctx.gymId))
    .limit(1)

  if (!gym) return null
  return { ...ctx, gymTimezone: gym.timezone }
}

// Search and validate — no side effects. Use to preview result before registering.
export async function searchFichajeAction(
  query: string,
): Promise<FichajeResult | ErrorResult> {
  const ctx = await getContext()
  if (!ctx) return { status: 'error', message: 'No autorizado' }

  return validateFichaje(query, ctx.gymId, ctx.gymTimezone, 'fichaje_admin')
}

// Validate a specific member by ID — no side effects. Use after selecting from multiple_matches.
export async function validateMemberFichajeAction(
  memberId: string,
): Promise<Exclude<FichajeResult, { status: 'multiple_matches' } | { status: 'not_found' }> | ErrorResult> {
  const ctx = await getContext()
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
  const ctx = await getContext()
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
    try {
      await recordVisit(memberId, ctx.gymId, 'fichaje_admin', false, ctx.user.id)
    } catch (err) {
      Sentry.captureException(err, { extra: { gymId: ctx.gymId, memberId, action: 'registerFichaje' } })
      logger.error(err as Error, { gymId: ctx.gymId, memberId, action: 'registerFichaje' })
      return { status: 'error', message: 'No se pudo registrar el fichaje' }
    }
    logger.info('fichaje.attempt', { gymId: ctx.gymId, memberId, channel: 'fichaje_admin', outcome: 'allowed', creditsRemaining: validation.creditsLeft })
    return {
      status: 'registered',
      wasOverLimit: false,
      memberName: member.fullName,
      creditsLeft: validation.creditsLeft,
    }
  }

  if (validation.status === 'over_limit_allowed') {
    try {
      await recordVisit(memberId, ctx.gymId, 'fichaje_admin', true, ctx.user.id)
    } catch (err) {
      Sentry.captureException(err, { extra: { gymId: ctx.gymId, memberId, action: 'registerFichaje' } })
      logger.error(err as Error, { gymId: ctx.gymId, memberId, action: 'registerFichaje' })
      return { status: 'error', message: 'No se pudo registrar el fichaje' }
    }
    logger.info('fichaje.attempt', { gymId: ctx.gymId, memberId, channel: 'fichaje_admin', outcome: 'over_limit_allowed', creditsRemaining: 0 })
    return {
      status: 'registered',
      wasOverLimit: true,
      memberName: member.fullName,
      creditsLeft: null,
    }
  }

  logger.info('fichaje.attempt', { gymId: ctx.gymId, memberId, channel: 'fichaje_admin', outcome: validation.status })
  return validation
}
