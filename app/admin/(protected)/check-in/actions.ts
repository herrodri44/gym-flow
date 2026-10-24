'use server'

import { db } from '@/lib/db/client'
import { members } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireGymAdmin } from '@/lib/auth/context'
import {
  validateFichaje,
  evaluateMemberFichaje,
  recordVisit,
  type FichajeResult,
  type MemberFichajeResult,
} from '@/lib/domain/fichaje'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

type ErrorResult = { status: 'error'; message: string }

export type RegisteredResult = {
  status: 'registered'
  outcome: 'ok' | 'over_limit_allowed' | 'grace_allowed'
  memberName: string
  /** Credits left after this visit; null for unlimited plans or grace visits */
  creditsLeft: number | null
  validUntil: string | null
}

async function findMember(memberId: string, gymId: string) {
  const [member] = await db
    .select({ id: members.id, fullName: members.fullName, documentNumber: members.documentNumber })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.gymId, gymId), eq(members.active, true)))
    .limit(1)
  return member ?? null
}

// Search and validate — no side effects. Use to preview result before registering.
export async function searchFichajeAction(query: string): Promise<FichajeResult | ErrorResult> {
  const ctx = await requireGymAdmin()
  if (!ctx) return { status: 'error', message: 'No autorizado' }

  const { result } = await validateFichaje(query, ctx.gymId, 'fichaje_admin')
  return result
}

// Validate a specific member by ID — no side effects. Use after selecting from multiple_matches.
export async function validateMemberFichajeAction(memberId: string): Promise<MemberFichajeResult | ErrorResult> {
  const ctx = await requireGymAdmin()
  if (!ctx) return { status: 'error', message: 'No autorizado' }

  const member = await findMember(memberId, ctx.gymId)
  if (!member) return { status: 'error', message: 'Socio no encontrado' }

  return (await evaluateMemberFichaje(member, ctx.gymId)).result
}

// Validate again (state may have changed since the preview) and register the visit.
export async function registerFichajeAction(
  memberId: string,
): Promise<RegisteredResult | MemberFichajeResult | ErrorResult> {
  const ctx = await requireGymAdmin()
  if (!ctx) return { status: 'error', message: 'No autorizado' }

  const member = await findMember(memberId, ctx.gymId)
  if (!member) return { status: 'error', message: 'Socio no encontrado' }

  const { result, visit } = await evaluateMemberFichaje(member, ctx.gymId)
  const log = { gymId: ctx.gymId, memberId, channel: 'fichaje_admin' }

  if (!visit) {
    logger.info('fichaje.attempt', { ...log, outcome: result.status })
    return result
  }

  let inserted: boolean
  try {
    inserted = await recordVisit({ memberId, gymId: ctx.gymId, channel: 'fichaje_admin', visit, recordedBy: ctx.user.id })
  } catch (err) {
    Sentry.captureException(err, { extra: { ...log, action: 'registerFichaje' } })
    logger.error(err as Error, { ...log, action: 'registerFichaje' })
    return { status: 'error', message: 'No se pudo registrar el fichaje' }
  }

  if (!inserted) {
    logger.info('fichaje.attempt', { ...log, outcome: 'already_today' })
    return { status: 'already_today', member }
  }

  const creditsLeft = result.status === 'ok' && result.creditsLeft !== null ? result.creditsLeft - 1 : null
  logger.info('fichaje.attempt', { ...log, outcome: result.status, creditsRemaining: creditsLeft })

  return {
    status: 'registered',
    outcome: result.status as RegisteredResult['outcome'],
    memberName: member.fullName,
    creditsLeft,
    validUntil: 'validUntil' in result ? result.validUntil : null,
  }
}
