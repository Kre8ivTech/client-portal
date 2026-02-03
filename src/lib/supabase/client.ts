import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${name}=`))
            ?.split('=')[1]
        },
        set(name: string, value: string, options: any) {
          try {
            document.cookie = `${name}=${value}; path=${options?.path || '/'}; ${
              options?.maxAge ? `max-age=${options.maxAge}` : ''
            }; ${options?.sameSite ? `samesite=${options.sameSite}` : 'samesite=lax'}`
          } catch (error) {
            // Ignore cookie errors - typically from third-party restrictions
          }
        },
        remove(name: string, options: any) {
          try {
            document.cookie = `${name}=; path=${options?.path || '/'}; max-age=0`
          } catch (error) {
            // Ignore cookie errors
          }
        },
      },
    }
  )
}
