// Postgres SQLSTATE codes we branch on. Drizzle may wrap the driver error, so
// the code can sit on the error itself or on its `cause` chain.
export const PG_UNIQUE_VIOLATION = '23505'
export const PG_EXCLUSION_VIOLATION = '23P01'

export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error
  while (current && typeof current === 'object') {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string') return code
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}
