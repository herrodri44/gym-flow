'use server'

import { db } from '@/lib/db/client'
import { gyms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { validateFichaje, recordVisit, type MemberFichajeResult } from '@/lib/domain/fichaje'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

// What the public kiosk is allowed to see: the outcome only. No member name
// or DNI ever leaves the server, so guessing DNIs reveals nothing.
type Outcome<S extends MemberFichajeResult['status']> = Omit<Extract<MemberFichajeResult, { status: S }>, 'member'>

export type PublicFichajeResult =
  | { [S in MemberFichajeResult['status']]: Outcome<S> }[MemberFichajeResult['status']]
  | { status: 'not_found' }
  | { status: 'invalid_gym' }
  | { status: 'error' }

// Public check-in — no authentication. Rate limited per IP in proxy.ts.
export async function publicFichajeAction(slug: string, documentNumber: string): Promise<PublicFichajeResult> {
  const trimmedDoc = documentNumber.trim()
  if (!trimmedDoc) return { status: 'not_found' }

  const [gym] = await db.select({ id: gyms.id }).from(gyms).where(eq(gyms.slug, slug)).limit(1)

  if (!gym) {
    logger.warn('fichaje.attempt', { channel: 'fichaje_public', outcome: 'invalid_gym', gymSlug: slug })
    return { status: 'invalid_gym' }
  }

  const { result, visit } = await validateFichaje(trimmedDoc, gym.id, 'fichaje_public')
  // Public search is exact DNI, so multiple matches can't happen; treat as not found.
  if (result.status === 'not_found' || result.status === 'multiple_matches') {
    logger.info('fichaje.attempt', { gymId: gym.id, channel: 'fichaje_public', outcome: result.status })
    return { status: 'not_found' }
  }

  const { member, ...outcome } = result
  const log = { gymId: gym.id, memberId: member.id, channel: 'fichaje_public' }

  if (!visit) {
    logger.info('fichaje.attempt', { ...log, outcome: result.status })
    return outcome
  }

  try {
    const inserted = await recordVisit({ memberId: member.id, gymId: gym.id, channel: 'fichaje_public', visit })
    if (!inserted) {
      logger.info('fichaje.attempt', { ...log, outcome: 'already_today' })
      return { status: 'already_today' }
    }
  } catch (err) {
    Sentry.captureException(err, { extra: { ...log, action: 'publicFichaje' } })
    logger.error(err as Error, { ...log, action: 'publicFichaje' })
    return { status: 'error' }
  }

  // Show what's left after this visit.
  if (outcome.status === 'ok' && outcome.creditsLeft !== null) {
    logger.info('fichaje.attempt', { ...log, outcome: 'ok', creditsRemaining: outcome.creditsLeft - 1 })
    return { ...outcome, creditsLeft: outcome.creditsLeft - 1 }
  }
  logger.info('fichaje.attempt', { ...log, outcome: outcome.status })
  return outcome
}
