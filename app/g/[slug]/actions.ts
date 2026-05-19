'use server'

import { db } from '@/lib/db/client'
import { gyms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  validateFichaje,
  recordVisit,
  type FichajeResult,
} from '@/lib/domain/fichaje'
import { logger } from '@/lib/logger'

type PublicFichajeResult = FichajeResult | { status: 'invalid_gym' }

// Public check-in — no authentication required.
// Rate limiting should be enforced at the edge (Vercel middleware or similar).
export async function publicFichajeAction(
  slug: string,
  documentNumber: string,
): Promise<PublicFichajeResult> {
  const trimmedDoc = documentNumber.trim()
  if (!trimmedDoc) return { status: 'not_found' }

  const [gym] = await db
    .select({ id: gyms.id, timezone: gyms.timezone })
    .from(gyms)
    .where(eq(gyms.slug, slug))
    .limit(1)

  if (!gym) {
    logger.warn('fichaje.attempt', { channel: 'fichaje_public', outcome: 'invalid_gym', gymSlug: slug })
    return { status: 'invalid_gym' }
  }

  const validation = await validateFichaje(
    trimmedDoc,
    gym.id,
    gym.timezone,
    'fichaje_public',
  )

  const memberId = 'member' in validation ? validation.member.id : undefined
  const creditsRemaining = validation.status === 'ok' ? validation.creditsLeft : undefined

  if (validation.status === 'ok') {
    await recordVisit(validation.member.id, gym.id, 'fichaje_public', false)
    logger.info('fichaje.attempt', { gymId: gym.id, memberId, channel: 'fichaje_public', outcome: 'allowed', creditsRemaining })
    return validation
  }

  if (validation.status === 'over_limit_allowed') {
    await recordVisit(validation.member.id, gym.id, 'fichaje_public', true)
    logger.info('fichaje.attempt', { gymId: gym.id, memberId, channel: 'fichaje_public', outcome: 'over_limit_allowed', creditsRemaining: 0 })
    return validation
  }

  logger.info('fichaje.attempt', { gymId: gym.id, memberId, channel: 'fichaje_public', outcome: validation.status })
  return validation
}
