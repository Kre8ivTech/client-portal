import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

function getSupabaseCredentials(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || url.includes('placeholder')) {
    throw new Error('Missing or invalid NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!anonKey || anonKey === 'placeholder') {
    throw new Error('Missing or invalid NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
  }

  return { url, anonKey }
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  const { url, anonKey } = getSupabaseCredentials()

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
