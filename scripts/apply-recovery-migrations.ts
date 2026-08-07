#!/usr/bin/env tsx

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Client } from 'pg'

const RECOVERY_MIGRATIONS = [
  '20260806000000_create_error_logs.sql',
  '20260806000001_fix_contracts_rls_recursion.sql',
] as const

function getConnectionString(): string {
  const configuredUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL

  if (configuredUrl) return configuredUrl

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const projectRef =
    process.env.SUPABASE_PROJECT_REF ||
    supabaseUrl?.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1]
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD

  if (!projectRef || !password) {
    throw new Error(
      'A direct Postgres URL or Supabase project reference and database password are required',
    )
  }

  return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`
}

async function applyRecoveryMigrations() {
  const client = new Client({
    connectionString: getConnectionString(),
    connectionTimeoutMillis: 15_000,
  })

  await client.connect()

  try {
    await client.query('BEGIN')
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('client-portal-required-recovery-migrations'))",
    )

    for (const migration of RECOVERY_MIGRATIONS) {
      const migrationPath = resolve(process.cwd(), 'supabase', 'migrations', migration)
      const sql = readFileSync(migrationPath, 'utf8')

      console.log(`Applying recovery migration ${migration}`)
      await client.query(sql)
    }

    const verification = await client.query<{
      error_logs_exists: boolean
      contract_helper_exists: boolean
    }>(`
      SELECT
        to_regclass('public.error_logs') IS NOT NULL AS error_logs_exists,
        to_regprocedure('public.can_view_contract(uuid)') IS NOT NULL AS contract_helper_exists
    `)

    const result = verification.rows[0]
    if (!result?.error_logs_exists || !result.contract_helper_exists) {
      throw new Error('Recovery migration verification failed')
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

applyRecoveryMigrations().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown migration error'
  console.error(`Recovery migrations failed: ${message}`)
  process.exit(1)
})
