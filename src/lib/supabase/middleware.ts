import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  const isApiPath = path.startsWith('/api')
  const isDashboardPath = path.startsWith('/dashboard')
  const isAuthPage =
    path === '/' ||
    path.startsWith('/login') ||
    path.startsWith('/signup') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password')

  if (
    !user &&
    isDashboardPath
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  if (user) {
    try {
      const { data: userRow, error: userRowError } = await (supabase as any)
        .from('users')
        .select('role, organization_id, status, mfa_enabled')
        .eq('id', user.id)
        .single()

      if (userRowError || !userRow) {
        throw new Error('Unable to verify account security state')
      }

      const role = (userRow as { role?: string } | null)?.role ?? 'client'
      const organizationId = (userRow as { organization_id?: string | null } | null)?.organization_id ?? null
      const userStatus = (userRow as { status?: string | null } | null)?.status ?? 'active'
      const userMfaEnabled = Boolean((userRow as { mfa_enabled?: boolean } | null)?.mfa_enabled)

      if (userStatus === 'inactive' || userStatus === 'suspended') {
        await supabase.auth.signOut()
        if (isApiPath) {
          const response = NextResponse.json({ error: 'Account is inactive' }, { status: 403 })
          supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
          return response
        }
        if (isDashboardPath) {
          const url = request.nextUrl.clone()
          url.pathname = '/login'
          url.searchParams.set('account_inactive', '1')
          const response = NextResponse.redirect(url)
          supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
          return response
        }
        return supabaseResponse
      }

      let mfaSettings: {
        mfa_enabled?: boolean
        mfa_required_for_staff?: boolean
        mfa_required_for_clients?: boolean
      } | null = null

      const { data: appSettings, error: appSettingsError } = await (supabase as any)
        .rpc('get_current_mfa_policy')
        .single()

      if (appSettingsError || !appSettings) {
        throw new Error('Unable to verify MFA policy')
      }

      mfaSettings = appSettings ?? null

      // Organization-level security (IP allowlist + session timeout)
      if (organizationId) {
        const { data: orgRow, error: orgRowError } = await (supabase as any)
          .from('organizations')
          .select('status, settings')
          .eq('id', organizationId)
          .single()

        if (orgRowError || !orgRow) {
          throw new Error('Unable to verify organization security state')
        }

        const organizationStatus = (orgRow as { status?: string | null } | null)?.status ?? 'active'
        if (organizationStatus === 'inactive' || organizationStatus === 'suspended') {
          await supabase.auth.signOut()
          if (isApiPath) {
            const response = NextResponse.json({ error: 'Organization is inactive' }, { status: 403 })
            supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
            return response
          }
          if (isDashboardPath) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.searchParams.set('organization_inactive', '1')
            const response = NextResponse.redirect(url)
            supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
            return response
          }
          return supabaseResponse
        }

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
      if ((isDashboardPath || isApiPath) && mfaSettings?.mfa_enabled !== false) {
        const isStaffLike = ['super_admin', 'staff', 'partner', 'partner_staff'].includes(role)
        const isClient = role === 'client'
        const mfaRequired =
          userMfaEnabled ||
          (Boolean(mfaSettings?.mfa_required_for_staff) && isStaffLike) ||
          (Boolean(mfaSettings?.mfa_required_for_clients) && isClient)

        if (mfaRequired) {
          // Enrollment required: user can only proceed to personal security settings.
          if (!userMfaEnabled && !path.startsWith(SECURITY_SETTINGS_PATH)) {
            if (isApiPath) {
              return NextResponse.json({ error: 'MFA enrollment required' }, { status: 403 })
            }
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
              if (isApiPath) {
                return NextResponse.json({ error: 'MFA verification required' }, { status: 403 })
              }
              const url = request.nextUrl.clone()
              url.pathname = '/login'
              url.searchParams.set('mfa_required', '1')
              return NextResponse.redirect(url)
            }
          }
        }
      }

      if (isAuthPage && !path.startsWith('/reset-password')) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    } catch (err) {
      console.error('[Middleware] Security check failed:', err instanceof Error ? err.message : 'Unknown error')
      if (isApiPath) {
        return NextResponse.json({ error: 'Security policy verification failed' }, { status: 503 })
      }
      if (isDashboardPath) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('security_error', '1')
        return NextResponse.redirect(url)
      }
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
