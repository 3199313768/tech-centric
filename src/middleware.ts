import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { isSafeNextPath } from '@/lib/auth/roles'
import { SITE_ROUTES } from '@/lib/site/routes'

const PUBLIC_PREFIXES = ['/login', '/forgot-password', '/reset-password', '/auth']

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )

  const { supabaseResponse, user } = await updateSession(request)

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const next = `${pathname}${search}`
    if (isSafeNextPath(next)) url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const next = request.nextUrl.searchParams.get('next')
    const url = request.nextUrl.clone()
    // role 在 middleware 不查 DB；管理员路径由目标页再拦
    url.pathname = isSafeNextPath(next) ? next : SITE_ROUTES.home
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|gltf)$).*)',
  ],
}
