import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'

// ─── Hoisted shared state ─────────────────────────────────────────────────────
// vi.hoisted is required because vi.mock is hoisted to the top of the file,
// so factory functions can't close over variables defined in module scope.

const { mockRatelimitLimit, mockGetUser } = vi.hoisted(() => ({
  mockRatelimitLimit: vi.fn(),
  mockGetUser: vi.fn(),
}))

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: vi.fn(() => ({})) },
}))

vi.mock('@upstash/ratelimit', () => {
  const RatelimitMock = vi.fn().mockImplementation(() => ({
    limit: mockRatelimitLimit,
  }))
  // Static method used at module init time inside proxy.ts
  ;(RatelimitMock as unknown as Record<string, unknown>).slidingWindow = vi.fn(
    () => 'mock-sliding-window',
  )
  return { Ratelimit: RatelimitMock }
})

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

const { proxy } = await import('@/proxy')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function req(pathname: string, cookieHeader?: string) {
  return new NextRequest(`http://localhost${pathname}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })
}

function noSession() {
  mockGetUser.mockResolvedValueOnce({ data: { user: null } })
}

function withSession(role: 'gym_admin' | 'superadmin' | 'member') {
  mockGetUser.mockResolvedValueOnce({
    data: { user: { id: 'user-1', app_metadata: { role } } },
  })
}

function isRedirectTo(response: Response, path: string) {
  return (
    response.status === 307 && (response.headers.get('location') ?? '').includes(path)
  )
}

function isPassThrough(response: Response) {
  return response.headers.has('x-middleware-next')
}

beforeEach(() => {
  mockRatelimitLimit.mockReset()
  mockGetUser.mockReset()
})

// ─── Rate limiting (/g/*) ─────────────────────────────────────────────────────

describe('public kiosk route (/g/*)', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    mockRatelimitLimit.mockResolvedValueOnce({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 5000,
    })

    const response = await proxy(req('/g/my-gym'))

    expect(response.status).toBe(429)
  })

  it('passes through when rate limit is not exceeded', async () => {
    mockRatelimitLimit.mockResolvedValueOnce({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 5000,
    })

    const response = await proxy(req('/g/my-gym'))

    expect(isPassThrough(response)).toBe(true)
  })

  it('does not check auth for /g/* routes', async () => {
    mockRatelimitLimit.mockResolvedValueOnce({ success: true, limit: 10, remaining: 9, reset: 0 })

    await proxy(req('/g/my-gym'))

    expect(mockGetUser).not.toHaveBeenCalled()
  })
})

// ─── Static assets ────────────────────────────────────────────────────────────

describe('static assets (/_next/*)', () => {
  it('passes through without redirecting', async () => {
    // proxy.ts always calls getUser() for cookie refresh (Supabase SSR pattern),
    // but /_next/* paths are returned as pass-through before any role check.
    noSession()
    const response = await proxy(req('/_next/static/chunk.js'))
    expect(isPassThrough(response)).toBe(true)
  })
})

// ─── Unauthenticated requests ─────────────────────────────────────────────────

describe('unauthenticated requests', () => {
  it('redirects to /login when visiting a protected route', async () => {
    noSession()
    const response = await proxy(req('/admin/dashboard'))
    expect(isRedirectTo(response, '/login')).toBe(true)
  })

  it('allows /login without redirecting', async () => {
    noSession()
    const response = await proxy(req('/login'))
    expect(isPassThrough(response)).toBe(true)
  })
})

// ─── Authenticated on /login ──────────────────────────────────────────────────

describe('authenticated user visiting /login', () => {
  it('redirects gym_admin to /admin/select-gym', async () => {
    withSession('gym_admin')
    const response = await proxy(req('/login'))
    expect(isRedirectTo(response, '/admin/select-gym')).toBe(true)
  })

  it('redirects superadmin to /superadmin/gyms', async () => {
    withSession('superadmin')
    const response = await proxy(req('/login'))
    expect(isRedirectTo(response, '/superadmin/gyms')).toBe(true)
  })

  it('redirects member to /portal/account', async () => {
    withSession('member')
    const response = await proxy(req('/login'))
    expect(isRedirectTo(response, '/portal/account')).toBe(true)
  })
})

// ─── Role-based route protection ──────────────────────────────────────────────

describe('role-based route protection', () => {
  it('redirects gym_admin away from /superadmin/*', async () => {
    withSession('gym_admin')
    const response = await proxy(req('/superadmin/gyms'))
    expect(isRedirectTo(response, '/admin/select-gym')).toBe(true)
  })

  it('redirects member away from /admin/*', async () => {
    withSession('member')
    const response = await proxy(req('/admin/dashboard'))
    expect(isRedirectTo(response, '/portal/account')).toBe(true)
  })

  it('allows superadmin to access /superadmin/*', async () => {
    withSession('superadmin')
    const response = await proxy(req('/superadmin/gyms'))
    expect(isPassThrough(response)).toBe(true)
  })
})

// ─── Active gym cookie requirement ───────────────────────────────────────────

describe('gym_admin active gym cookie', () => {
  it('redirects to /admin/select-gym when cookie is missing', async () => {
    withSession('gym_admin')
    const response = await proxy(req('/admin/dashboard'))
    expect(isRedirectTo(response, '/admin/select-gym')).toBe(true)
  })

  it('passes through when cookie is present', async () => {
    withSession('gym_admin')
    const response = await proxy(
      req('/admin/dashboard', `${ACTIVE_GYM_COOKIE}=gym-1`),
    )
    expect(isPassThrough(response)).toBe(true)
  })

  it('allows /admin/select-gym even without the cookie', async () => {
    withSession('gym_admin')
    const response = await proxy(req('/admin/select-gym'))
    expect(isPassThrough(response)).toBe(true)
  })
})
