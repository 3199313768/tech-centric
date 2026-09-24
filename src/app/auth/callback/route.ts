import { NextResponse } from 'next/server'
import { resolveResetNextPath } from '@/lib/auth/passwordReset'
import { createClient } from '@/lib/supabase/server'

const INVALID_LINK_PATH = '/forgot-password?error=invalid-link'

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL(INVALID_LINK_PATH, requestUrl.origin))
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(new URL(INVALID_LINK_PATH, requestUrl.origin))
    }

    const nextPath = resolveResetNextPath(requestUrl.searchParams.get('next'))
    return NextResponse.redirect(new URL(nextPath, requestUrl.origin))
  } catch {
    return NextResponse.redirect(new URL(INVALID_LINK_PATH, requestUrl.origin))
  }
}
