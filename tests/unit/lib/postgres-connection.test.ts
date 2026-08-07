import { describe, expect, it } from 'vitest'
import { normalizeSupabaseSslConnection } from '../../../scripts/lib/postgres-connection'

describe('normalizeSupabaseSslConnection', () => {
  it('uses encrypted libpq compatibility mode for Supabase direct connections', () => {
    const result = normalizeSupabaseSslConnection(
      'postgresql://user:password@db.project-ref.supabase.co:5432/postgres?sslmode=verify-full',
    )
    const url = new URL(result)

    expect(url.searchParams.get('sslmode')).toBe('require')
    expect(url.searchParams.get('uselibpqcompat')).toBe('true')
  })

  it('supports Supabase pooler connections', () => {
    const result = normalizeSupabaseSslConnection(
      'postgresql://user:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
    )
    const url = new URL(result)

    expect(url.searchParams.get('sslmode')).toBe('require')
    expect(url.searchParams.get('uselibpqcompat')).toBe('true')
  })

  it('does not change TLS settings for non-Supabase hosts', () => {
    const connectionString =
      'postgresql://user:password@database.example.com:5432/postgres?sslmode=verify-full'

    expect(normalizeSupabaseSslConnection(connectionString)).toBe(connectionString)
  })

  it('rejects non-Postgres connection URLs without including their value', () => {
    expect(() =>
      normalizeSupabaseSslConnection('https://user:secret@example.com/database'),
    ).toThrow('The configured database URL must use the Postgres protocol')
  })
})
