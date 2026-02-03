#!/usr/bin/env tsx

/**
 * Run Supabase migrations
 * This script runs during Vercel deployment to apply pending migrations
 * 
 * Environment variables supported:
 * - POSTGRES_URL_NON_POOLING | POSTGRES_PRISMA_URL | POSTGRES_URL: direct DB URL
 * - POSTGRES_PASSWORD: DB password (fallback for SUPABASE_DB_PASSWORD)
 * - SUPABASE_URL: used to derive project ref if needed
 * - SUPABASE_ACCESS_TOKEN: Supabase access token for CLI (optional if using DB URL)
 * - SUPABASE_PROJECT_REF: Project reference ID (optional if SUPABASE_URL provided)
 * - SUPABASE_DB_PASSWORD: Database password (optional if POSTGRES_PASSWORD provided)
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const DB_URL_ENV_VARS = [
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL',
]

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function getDbUrl() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL
  )
}

function deriveProjectRef() {
  const supabaseUrl = process.env.SUPABASE_URL
  if (!supabaseUrl) return undefined

  const match = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/)
  return match?.[1]
}

function checkEnvironment() {
  log('🔍 Checking environment variables...', 'blue')
  
  const dbUrl = getDbUrl()
  if (dbUrl) {
    log('✅ Using database URL from Vercel environment', 'green')
    return
  }

  const projectRef = process.env.SUPABASE_PROJECT_REF || deriveProjectRef()
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD

  const missing: string[] = []
  if (!accessToken) missing.push('SUPABASE_ACCESS_TOKEN')
  if (!projectRef) missing.push('SUPABASE_PROJECT_REF or SUPABASE_URL')
  if (!dbPassword) missing.push('SUPABASE_DB_PASSWORD or POSTGRES_PASSWORD')

  if (missing.length > 0) {
    log(`❌ Missing required environment variables:`, 'red')
    missing.forEach(varName => log(`   - ${varName}`, 'red'))
    log('\nℹ️  To fix this:', 'yellow')
    log('   1. Go to Vercel Dashboard > Settings > Environment Variables', 'yellow')
    log('   2. Add the missing variables for production', 'yellow')
    log('   3. Redeploy the application', 'yellow')

    // In production, skipping migrations can leave the app in a broken state
    // (code expects schema changes that were never applied).
    log('\n❌ Aborting deployment: migrations cannot run without credentials', 'red')
    process.exit(1)
  }

  log('✅ All required environment variables present', 'green')
}

function checkSupabaseCLI() {
  log('\n🔍 Checking Supabase CLI...', 'blue')
  
  try {
    execSync('supabase --version', { stdio: 'pipe' })
    log('✅ Supabase CLI is installed', 'green')
    return true
  } catch (error) {
    log('⚠️  Supabase CLI not found in path.', 'yellow')
    log('   Ensure it is installed as a devDependency and run via npm scripts.', 'yellow')
    return false
  }
}

function checkMigrations() {
  log('\n🔍 Checking for migrations...', 'blue')
  
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
  
  if (!existsSync(migrationsDir)) {
    log('⚠️  No migrations directory found', 'yellow')
    log('   Skipping migrations', 'yellow')
    return false
  }
  
  log(`✅ Migrations directory found: ${migrationsDir}`, 'green')
  return true
}

function linkSupabaseProject() {
  log('\n🔗 Linking Supabase project...', 'blue')
  
  const projectRef = process.env.SUPABASE_PROJECT_REF || deriveProjectRef()
  if (!projectRef) {
    log('❌ Missing project reference for linking', 'red')
    return false
  }
  
  try {
    // Link to remote project
    execSync(
      `supabase link --project-ref ${projectRef}`,
      { 
        stdio: 'pipe',
        env: {
          ...process.env,
          SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
        }
      }
    )
    log('✅ Successfully linked to Supabase project', 'green')
    return true
  } catch (error: any) {
    log('❌ Failed to link Supabase project', 'red')
    log(`   Error: ${error.message}`, 'red')
    return false
  }
}

function runMigrations() {
  log('\n🚀 Running migrations...', 'blue')

  try {
    const dbUrl = getDbUrl()
    const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD

    // First try normal push (without --include-all)
    // This is safer as it only applies new migrations
    let needsIncludeAll = false
    try {
      log('\n▶️  Attempting to apply new migrations...', 'blue')
      execSync(
        dbUrl
          ? `supabase db push --db-url "${dbUrl}"`
          : 'supabase db push',
        {
          stdio: ['ignore', 'pipe', 'pipe'], // Capture output to detect errors
          encoding: 'utf-8',
          env: {
            ...process.env,
            SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
            SUPABASE_DB_PASSWORD: dbPassword,
          }
        }
      )

      log('\n✅ Migrations applied successfully!', 'green')
      return true
    } catch (pushError: any) {
      // Capture both stdout and stderr
      const errorOutput = (pushError.stdout || '') + (pushError.stderr || '') + (pushError.message || '')

      // Log the error for debugging
      if (pushError.stdout) {
        console.log(pushError.stdout)
      }
      if (pushError.stderr) {
        console.error(pushError.stderr)
      }

      // Check if error is about duplicate keys (migrations already applied)
      if (errorOutput.includes('duplicate key') && errorOutput.includes('schema_migrations')) {
        log('✅ Migrations already applied (duplicate key detected), skipping', 'green')
        return true
      }

      // Check if the error is about history mismatch which can be resolved with --include-all
      if (errorOutput.includes('include-all') || errorOutput.includes('history table') || errorOutput.includes('Found local migration files')) {
        log('⚠️  Migration history mismatch detected. Will retry with --include-all...', 'yellow')
        needsIncludeAll = true
      } else {
        // Genuine error, rethrow
        throw pushError
      }
    }

    // Only use --include-all if history mismatch detected
    if (needsIncludeAll) {
      log('\n▶️  Applying migrations with --include-all...', 'blue')
      try {
        const output = execSync(
          dbUrl
            ? `supabase db push --include-all --db-url "${dbUrl}"`
            : 'supabase db push --include-all',
          {
            stdio: ['ignore', 'pipe', 'pipe'], // Capture output to detect duplicate key errors
            encoding: 'utf-8',
            env: {
              ...process.env,
              SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
              SUPABASE_DB_PASSWORD: dbPassword,
            },
            input: 'Y\n' // Auto-confirm the prompt
          }
        )

        // Log the output
        if (output) {
          console.log(output)
        }

        log('\n✅ Migrations applied successfully!', 'green')
        return true
      } catch (includeAllError: any) {
        const errorOutput = (includeAllError.stdout || '') + (includeAllError.stderr || '') + (includeAllError.message || '')

        // Log the error output for debugging
        if (includeAllError.stdout) {
          console.log(includeAllError.stdout)
        }
        if (includeAllError.stderr) {
          console.error(includeAllError.stderr)
        }

        // Check again for duplicate keys (migrations already applied via --include-all)
        if (errorOutput.includes('duplicate key') && errorOutput.includes('schema_migrations')) {
          log('✅ Migrations already applied (duplicate key with --include-all), continuing', 'green')
          return true
        }

        // Genuine error
        throw includeAllError
      }
    }

    return true
  } catch (error: any) {
    log('❌ Migration failed', 'red')
    log(`   Error: ${error.message}`, 'red')

    // Fail the build if migrations fail
    log('\n❌ Build failed due to migration error', 'red')
    process.exit(1)
  }
}

function main() {
  log('═══════════════════════════════════════════════', 'blue')
  log('   Supabase Migration Runner for Vercel', 'blue')
  log('═══════════════════════════════════════════════', 'blue')
  
  // Only run migrations in production
  if (process.env.VERCEL_ENV !== 'production') {
    log('\n⚠️  Not in production environment, skipping migrations', 'yellow')
    log(`   Current environment: ${process.env.VERCEL_ENV || 'local'}`, 'yellow')
    log('   Migrations only run on production deployments', 'yellow')
    process.exit(0)
  }
  
  // Check environment
  checkEnvironment()
  
  // Check if migrations exist
  if (!checkMigrations()) {
    process.exit(0)
  }
  
  // Check/install Supabase CLI
  if (!checkSupabaseCLI()) {
    process.exit(0)
  }
  
  const dbUrl = getDbUrl()
  if (!dbUrl) {
    // Link project (only needed without direct DB URL)
    if (!linkSupabaseProject()) {
      log('\n❌ Cannot proceed without project link', 'red')
      process.exit(1)
    }
  }
  
  // Run migrations
  runMigrations()
  
  log('\n═══════════════════════════════════════════════', 'blue')
  log('   ✅ Migration process completed successfully', 'green')
  log('═══════════════════════════════════════════════', 'blue')
}

// Run the script
main()
