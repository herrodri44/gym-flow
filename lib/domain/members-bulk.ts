import { db } from '@/lib/db/client'
import { members } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export type BulkMemberInput = {
  row: number
  fullName: string
  documentNumber: string
  phone: string | null
  email: string | null
  birthDate: string | null
  joinedAt: string | null
}

export type BulkCreateResult = {
  created: number
  skipped: number
  errors: Array<{ row: number; reason: string }>
}

export async function bulkCreateMembers(
  gymId: string,
  rows: BulkMemberInput[],
): Promise<BulkCreateResult> {
  if (rows.length === 0) return { created: 0, skipped: 0, errors: [] }

  const existingRows = await db
    .select({ documentNumber: members.documentNumber })
    .from(members)
    .where(eq(members.gymId, gymId))

  const existingDNIs = new Set(existingRows.map((r) => r.documentNumber))

  let created = 0
  let skipped = 0
  const errors: BulkCreateResult['errors'] = []
  const seenInBatch = new Set<string>()

  for (const input of rows) {
    if (existingDNIs.has(input.documentNumber)) {
      skipped++
      continue
    }
    if (seenInBatch.has(input.documentNumber)) {
      errors.push({ row: input.row, reason: 'DNI duplicado dentro del archivo' })
      continue
    }

    seenInBatch.add(input.documentNumber)

    try {
      await db.insert(members).values({
        gymId,
        fullName: input.fullName,
        documentNumber: input.documentNumber,
        phone: input.phone,
        email: input.email,
        birthDate: input.birthDate,
        joinedAt: input.joinedAt,
        userId: null,
      })
      created++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('unique')) {
        skipped++
      } else {
        errors.push({ row: input.row, reason: 'Error al insertar' })
      }
    }
  }

  return { created, skipped, errors }
}
