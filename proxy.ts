import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { ACTIVE_GYM_COOKIE, ROLE_HOME, type UserRole } from '@/lib/auth/roles'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
})

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate-limit the public check-in route before touching auth
  if (pathname.startsWith('/g/')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'anonymous'
    const { success, limit, remaining, reset } = await ratelimit.limit(ip)
    if (!success) {
      return new NextResponse('Demasiadas solicitudes. Intentá de nuevo en unos segundos.', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    }
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // No agregar código entre createServerClient y getUser()
  const { data: { user } } = await supabase.auth.getUser()

  // Rutas siempre públicas (/_next, /api/public, /legal — /g/ ya fue manejado arriba)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/legal')
  ) {
    return supabaseResponse
  }

  // Sin sesión → login (excepto si ya está en /login)
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Con sesión en /login → redirigir a home según rol
  if (user && pathname === '/login') {
    const role = user.app_metadata?.role as UserRole | undefined
    const home = role ? ROLE_HOME[role] : '/login'
    const url = request.nextUrl.clone()
    url.pathname = home
    return NextResponse.redirect(url)
  }

  if (!user) return supabaseResponse

  const role = user.app_metadata?.role as UserRole | undefined

  // Protección de rutas por rol
  if (pathname.startsWith('/superadmin') && role !== 'superadmin') {
    return redirectToHome(request, role)
  }

  if (pathname.startsWith('/admin')) {
    if (role !== 'gym_admin') return redirectToHome(request, role)

    // El admin necesita gym activo para todas las rutas salvo el selector y la aceptación de términos
    if (
      pathname !== '/admin/select-gym' &&
      pathname !== '/admin/accept-terms' &&
      !request.cookies.get(ACTIVE_GYM_COOKIE)
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/select-gym'
      return NextResponse.redirect(url)
    }
  }

  if (pathname.startsWith('/portal') && role !== 'member') {
    return redirectToHome(request, role)
  }

  return supabaseResponse
}

function redirectToHome(request: NextRequest, role: UserRole | undefined) {
  const url = request.nextUrl.clone()
  url.pathname = role ? ROLE_HOME[role] : '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
