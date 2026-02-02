#!/usr/bin/env tsx

/**
 * Run Supabase migrations
 * This script runs during Vercel deployment to apply pending migrations
 * 
 * Environment variables required:
 * - SUPABASE_ACCESS_TOKEN: Supabase access token for CLI
 * - SUPABASE_PROJECT_REF: Project reference ID
 * - SUPABASE_DB_PASSWORD: Database password
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const REQUIRED_ENV_VARS = [
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_PROJECT_REF',
  'SUPABASE_DB_PASSWORD',
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

function checkEnvironment() {
  log('🔍 Checking environment variables...', 'blue')
  
  const missing = REQUIRED_ENV_VARS.filter(varName => !process.env[varName])
  
  if (missing.length > 0) {
    log(`❌ Missing required environment variables:`, 'red')
    missing.forEach(varName => log(`   - ${varName}`, 'red'))
    log('\nℹ️  To fix this:', 'yellow')
    log('   1. Go to Vercel Dashboard > Settings > Environment Variables', 'yellow')
    log('   2. Add the missing variables for production', 'yellow')
    log('   3. Redeploy the application', 'yellow')
    
    // Don't fail the build, just skip migrations
    log('\n⚠️  Skipping migrations due to missing credentials', 'yellow')
    process.exit(0)
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
    log('⚠️  Supabase CLI not found, installing...', 'yellow')
    try {
      execSync('npm install -g supabase', { stdio: 'inherit' })
      log('✅ Supabase CLI installed successfully', 'green')
      return true
    } catch (installError) {
      log('❌ Failed to install Supabase CLI', 'red')
      log('   Skipping migrations', 'yellow')
      return false
    }
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
  
  const projectRef = process.env.SUPABASE_PROJECT_REF!
  
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
    const output = execSync(
      'supabase db push --dry-run',
      { 
        encoding: 'utf-8',
        env: {
          ...process.env,
          SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
          SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD,
        }
      }
    )
    
    log('📋 Migration preview:', 'blue')
    console.log(output)
    
    // Actually run migrations
    log('\n▶️  Applying migrations...', 'blue')
    execSync(
      'supabase db push',
      { 
        stdio: 'inherit',
        env: {
          ...process.env,
          SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
          SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD,
        }
      }
    )
    
    log('\n✅ Migrations applied successfully!', 'green')
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
  
  // Link project
  if (!linkSupabaseProject()) {
    log('\n❌ Cannot proceed without project link', 'red')
    process.exit(1)
  }
  
  // Run migrations
  runMigrations()
  
  log('\n═══════════════════════════════════════════════', 'blue')
  log('   ✅ Migration process completed successfully', 'green')
  log('═══════════════════════════════════════════════', 'blue')
}

// Run the script
main()
