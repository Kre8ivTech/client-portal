import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'
const SECURITY_SETTINGS_PATH = '/dashboard/settings/security'

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null
  }
  const realIp = request.headers.get('x-real-ip')
  return realIp?.trim() || null
}

function isIpAllowed(clientIp: string | null, whitelist: string[]): boolean {
  if (whitelist.length === 0) return true
  if (!clientIp) return false
  return whitelist.includes(clientIp)
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake can make it very hard to debug
  // issues with users being logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthPage =
    path === '/' ||
    path.startsWith('/login') ||
    path.startsWith('/signup') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password')

  if (user && isAuthPage && !path.startsWith('/reset-password')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (
    !user &&
    !isAuthPage &&
    !path.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  if (user) {
    try {
      const { data: userRow } = await (supabase as any)
        .from('users')
        .select('role, organization_id, mfa_enabled')
        .eq('id', user.id)
        .single()

      const role = (userRow as { role?: string } | null)?.role ?? 'client'
      const organizationId = (userRow as { organization_id?: string | null } | null)?.organization_id ?? null
      const userMfaEnabled = Boolean((userRow as { mfa_enabled?: boolean } | null)?.mfa_enabled)

      let mfaSettings: {
        mfa_enabled?: boolean
        mfa_required_for_staff?: boolean
        mfa_required_for_clients?: boolean
      } | null = null

      const { data: appSettings } = await (supabase as any)
        .from('app_settings')
        .select('mfa_enabled, mfa_required_for_staff, mfa_required_for_clients')
        .eq('id', APP_SETTINGS_ID)
        .single()

      mfaSettings = appSettings ?? null

      // Organization-level security (IP allowlist + session timeout)
      if (organizationId) {
        const { data: orgRow } = await (supabase as any)
          .from('organizations')
          .select('settings')
          .eq('id', organizationId)
          .single()

        const securitySettings = (orgRow as { settings?: any } | null)?.settings?.security ?? {}
        const ipWhitelist = Array.isArray(securitySettings.ip_whitelist)
          ? securitySettings.ip_whitelist.filter((ip: unknown): ip is string => typeof ip === 'string')
          : []

        if (ipWhitelist.length > 0) {
          const clientIp = getClientIp(request)
          if (!isIpAllowed(clientIp, ipWhitelist)) {
            return new NextResponse('Access denied from this IP address', { status: 403 })
          }
        }

        const timeoutMinutes =
          typeof securitySettings.session_timeout_minutes === 'number'
            ? securitySettings.session_timeout_minutes
            : 60
        const timeoutMs = Math.max(5, timeoutMinutes) * 60 * 1000
        const now = Date.now()
        const lastActivityCookie = request.cookies.get('kt_last_activity')?.value
        const lastActivity = lastActivityCookie ? Number(lastActivityCookie) : NaN

        if (!Number.isNaN(lastActivity) && now - lastActivity > timeoutMs) {
          await supabase.auth.signOut()
          const url = request.nextUrl.clone()
          url.pathname = '/login'
          url.searchParams.set('session_expired', '1')
          const response = NextResponse.redirect(url)
          response.cookies.set('kt_last_activity', '', { path: '/', maxAge: 0 })
          return response
        }

        supabaseResponse.cookies.set('kt_last_activity', String(now), {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        })
      }

      // MFA policy enforcement on protected routes.
      if (path.startsWith('/dashboard') && mfaSettings?.mfa_enabled !== false) {
        const isStaffLike = ['super_admin', 'staff', 'partner', 'partner_staff'].includes(role)
        const isClient = role === 'client'
        const mfaRequired =
          (Boolean(mfaSettings?.mfa_required_for_staff) && isStaffLike) ||
          (Boolean(mfaSettings?.mfa_required_for_clients) && isClient)

        if (mfaRequired) {
          // Enrollment required: user can only proceed to personal security settings.
          if (!userMfaEnabled && !path.startsWith(SECURITY_SETTINGS_PATH)) {
            const url = request.nextUrl.clone()
            url.pathname = SECURITY_SETTINGS_PATH
            url.searchParams.set('required_mfa', '1')
            return NextResponse.redirect(url)
          }

          // Challenge required: verified factor exists but current session is aal1.
          if (userMfaEnabled) {
            const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
            const isAal2 = aalData?.currentLevel === 'aal2'
            if (!isAal2) {
              const url = request.nextUrl.clone()
              url.pathname = '/login'
              url.searchParams.set('mfa_required', '1')
              return NextResponse.redirect(url)
            }
          }
        }
      }
    } catch {
      // Fail open to avoid locking users out on transient middleware query failures.
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but stop using
  //    the supabaseResponse object after as it will be out of date.

  return supabaseResponse
}
