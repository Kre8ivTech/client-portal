import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import type { Database } from '@/types/database'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = cookies()
    const redirectResponse = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              redirectResponse.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Log successful login
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const headersList = headers()
          const userAgent = headersList.get('user-agent') || 'unknown'
          const forwardedFor = headersList.get('x-forwarded-for')
          const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

          // Get user's organization_id
          const { data: profile } = await supabase
            .from('users')
            .select('organization_id')
            .eq('id', user.id)
            .single()

          await (supabase as any).from('audit_logs').insert({
            organization_id: (profile as { organization_id?: string } | null)?.organization_id ?? null,
            user_id: user.id,
            action: 'user.login',
            entity_type: 'user',
            entity_id: user.id,
            details: {
              method: 'oauth_or_magic_link',
              email: user.email,
              ip_address: ip,
              user_agent: userAgent,
            },
          })
        }
      } catch {
        // Audit logging is best-effort, don't block login
      }

      return redirectResponse
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_callback_failed`)
}
