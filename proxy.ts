import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase-middleware'

const PROTECTED_PREFIXES = [
  '/dashboard', '/upload', '/imports', '/diagnostico', '/funil',
  '/criativos', '/campanhas', '/meta-sync', '/dark-posts', '/configuracoes',
  '/estrutura', '/rascunhos',
]

const AUTH_PAGES = ['/login', '/register']

export async function proxy(request: NextRequest) {
  const { response, user, configured, unauthorized } = await updateSession(request)

  // Supabase not configured — local mode fallback, no auth gate.
  if (!configured) return response

  if (unauthorized) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(loginUrl)
  }

  const path = request.nextUrl.pathname

  // Root is a special case (not a prefix match — every path starts with "/"):
  // signed-in users go straight to the dashboard, signed-out users to login.
  if (path === '/') {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', path)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const isProtected = PROTECTED_PREFIXES.some(p => path === p || path.startsWith(`${p}/`))
  const isAuthPage = AUTH_PAGES.some(p => path === p || path.startsWith(`${p}/`))

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
