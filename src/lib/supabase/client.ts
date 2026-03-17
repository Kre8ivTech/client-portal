import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  const isBrowser = typeof document !== 'undefined'
  const isProduction = typeof window !== 'undefined' && window.location.protocol === 'https:'

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (!isBrowser) return undefined
          const match = document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${name}=`))
          if (!match) return undefined
          // Preserve full value including '=' characters (common in base64 JWTs)
          return match.split('=').slice(1).join('=')
        },
        set(name: string, value: string, options: any) {
          if (!isBrowser) return
          try {
            const parts = [
              `${name}=${value}`,
              `path=${options?.path || '/'}`,
            ]
            if (options?.maxAge) parts.push(`max-age=${options.maxAge}`)
            parts.push(`samesite=${options?.sameSite || 'lax'}`)
            if (isProduction || options?.secure) parts.push('secure')
            document.cookie = parts.join('; ')
          } catch {
            // Ignore cookie errors - typically from third-party restrictions
          }
        },
        remove(name: string, options: any) {
          if (!isBrowser) return
          try {
            document.cookie = `${name}=; path=${options?.path || '/'}; max-age=0`
          } catch {
            // Ignore cookie errors
          }
        },
      },
    }
  )
}
