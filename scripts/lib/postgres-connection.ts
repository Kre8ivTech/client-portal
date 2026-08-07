export function normalizeSupabaseSslConnection(connectionString: string): string {
  let url: URL

  try {
    url = new URL(connectionString)
  } catch {
    throw new Error('The configured Postgres connection URL is invalid')
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('The configured database URL must use the Postgres protocol')
  }

  const hostname = url.hostname.toLowerCase()
  const isSupabaseHost =
    hostname.endsWith('.supabase.co') || hostname.endsWith('.supabase.com')

  if (!isSupabaseHost) return connectionString

  // Supabase connection endpoints can present a self-signed certificate chain.
  // Use libpq's `require` semantics (encrypted without CA verification) only for
  // Supabase-owned hosts; all other Postgres URLs retain their configured mode.
  url.searchParams.set('uselibpqcompat', 'true')
  url.searchParams.set('sslmode', 'require')

  return url.toString()
}
