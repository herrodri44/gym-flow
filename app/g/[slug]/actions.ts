'use server'

import { db } from '@/lib/db/client'
import { gyms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  validateFichaje,
  recordVisit,
  type FichajeResult,
} from '@/lib/domain/fichaje'

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

  if (!gym) return { status: 'invalid_gym' }

  const validation = await validateFichaje(
    trimmedDoc,
    gym.id,
    gym.timezone,
    'fichaje_public',
  )

  if (validation.status === 'ok') {
    await recordVisit(validation.member.id, gym.id, 'fichaje_public', false)
    return validation
  }

  if (validation.status === 'over_limit_allowed') {
    await recordVisit(validation.member.id, gym.id, 'fichaje_public', true)
    return validation
  }

  return validation
}
