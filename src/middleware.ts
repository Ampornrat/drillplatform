import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes requiring specific roles — checked by fetching profile in middleware.
// Only used for routes that are meaningless without the right role.
const ADMIN_ONLY_PREFIXES = ['/admin']
const MANAGE_PREFIXES = ['/planner', '/core/authority-matrix', '/core/safety-gates']

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your_supabase')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isAuthPath = pathname.startsWith('/login') || pathname.startsWith('/register')

  const isDashboardPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/planner') ||
    pathname.startsWith('/observer') ||
    pathname.startsWith('/participant') ||
    pathname.startsWith('/core') ||
    pathname.startsWith('/operation') ||
    pathname.startsWith('/context')

  // ── Unauthenticated → redirect to login ──────────────────────────────────
  if (isDashboardPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // ── Authenticated + auth page → redirect to dashboard ────────────────────
  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── Role-based path guards (requires profile query) ───────────────────────
  if (user && isDashboardPath) {
    const isAdminOnly = ADMIN_ONLY_PREFIXES.some(p => pathname.startsWith(p))
    const isManageOnly = MANAGE_PREFIXES.some(p => pathname.startsWith(p))

    if (isAdminOnly || isManageOnly) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = profile?.role ?? 'guest'

      if (isAdminOnly && role !== 'admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/forbidden'
        return NextResponse.redirect(url)
      }

      if (isManageOnly && !['admin', 'commander', 'controller'].includes(role)) {
        const url = request.nextUrl.clone()
        url.pathname = '/forbidden'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
