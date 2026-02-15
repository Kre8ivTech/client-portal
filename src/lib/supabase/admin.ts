import { createClient } from '@supabase/supabase-js'

/**
 * SECURITY: Get Supabase admin client with service role key
 *
 * IMPORTANT: Service role key bypasses Row Level Security (RLS).
 * Only use in server-side code (API routes, Server Components).
 * NEVER expose this client to the browser.
 *
 * Usage patterns that require service role:
 * - Cross-organization queries (partners viewing clients)
 * - System-level operations (cron jobs, migrations)
 * - User impersonation (with explicit authorization)
 *
 * @throws {Error} If environment variables are missing
 * @returns Supabase client with admin privileges
 */
export const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Fail immediately if credentials are missing (SECURITY FIX)
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is required. ' +
      'Set in .env.local or Vercel environment variables.'
    )
  }

  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required. ' +
      'CRITICAL: This key bypasses RLS. Never expose to client code. ' +
      'Set in .env.local or Vercel environment variables.'
    )
  }

  // Additional validation: ensure it's not a placeholder
  if (url.includes('placeholder') || key.includes('placeholder')) {
    throw new Error(
      'Invalid Supabase credentials detected (placeholder values). ' +
      'Update environment variables with real credentials.'
    )
  }

  return createClient(url, key, {
    auth: {
      // Disable auto-refresh for service role (not needed for server-side)
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as any
}

/**
 * DEPRECATED: Direct module-level instantiation removed for security
 *
 * MIGRATION: Replace all usages of `supabaseAdmin` with `getSupabaseAdmin()`
 *
 * Why this was removed:
 * 1. Module-level instantiation happens before env validation
 * 2. Placeholder values can cause silent failures
 * 3. Better error messages with lazy initialization
 * 4. Prevents accidental usage in client code
 *
 * @deprecated Use getSupabaseAdmin() instead
 */
// Removed: export const supabaseAdmin = createClient(...)

/**
 * Backward-compatible lazy admin client.
 * Accessing any property resolves getSupabaseAdmin() at call time.
 */
export const supabaseAdmin = new Proxy({} as ReturnType<typeof getSupabaseAdmin>, {
  get(_target, prop) {
    const client = getSupabaseAdmin() as any
    return client[prop]
  },
})
