import { vi } from 'vitest'

/**
 * Creates a mock Drizzle select chain that resolves to `value`.
 *
 * Supports two termination patterns:
 *   .from().where().limit(n)  → terminates with limit()
 *   await .from().where()     → terminated by awaiting (aggregate queries)
 */
export function makeSelectChain(value: unknown[]) {
  const whereResult = {
    limit: vi.fn().mockResolvedValue(value),
    then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
      return Promise.resolve(value).then(resolve, reject)
    },
    catch(onRejected: (e: unknown) => unknown) {
      return Promise.resolve(value).catch(onRejected)
    },
  }

  const joinable: Record<string, unknown> = {
    where: vi.fn(() => whereResult),
  }
  joinable.innerJoin = vi.fn().mockReturnValue(joinable)
  joinable.leftJoin = vi.fn().mockReturnValue(joinable)

  return { from: vi.fn(() => joinable) }
}

export function makeInsertMock() {
  return vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }))
}

export function makeUpdateMock() {
  const whereFn = vi.fn().mockResolvedValue(undefined)
  const setFn = vi.fn(() => ({ where: whereFn }))
  const mock = vi.fn(() => ({ set: setFn }))
  return { mock, setFn, whereFn }
}
