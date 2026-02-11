# Automatic Migration Deployment Guide

## Overview

KT-Portal automatically runs database migrations when deploying to Vercel production. This ensures your database schema stays in sync with your application code.

## How It Works

### Deployment Flow

```
Push to main branch
    ↓
Vercel starts build
    ↓
npm install (includes Supabase CLI)
    ↓
npm run build
    ↓
npm run migrate (runs migrations)
    ↓
supabase db push (applies pending migrations)
    ↓
next build (builds application)
    ↓
Deployment complete
```

### Environment-Specific Behavior

**Production Deployments:**
- ✅ Migrations run automatically
- ✅ Fails build if migrations fail
- ✅ Ensures database is up-to-date

**Preview Deployments (Pull Requests):**
- ⚠️ Migrations are **skipped** by default
- Prevents conflicts with production database
- Optional: Use separate preview database (see below)

**Local Development:**
- Use `npm run migrate:local` or `supabase db push` manually
- Or use `npm run build:local` to skip migrations

## Setup Instructions

### 1. Get Supabase Credentials

You need three environment variables for migration automation:

**SUPABASE_ACCESS_TOKEN:**
1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate New Token"
3. Give it a name (e.g., "Vercel Migrations")
4. Copy the token (save it securely - shown only once!)

**SUPABASE_PROJECT_REF:**
1. Open your Supabase project
2. Go to Settings → General
3. Copy the "Reference ID" (looks like `abcdefghijklmnop`)

**SUPABASE_DB_PASSWORD:**
1. Go to Settings → Database
2. This is the password you set when creating the project
3. If you forgot it, you can reset it (this will update the connection string)

### 2. Add to Vercel

#### Via Vercel Dashboard (Recommended)

1. Go to your Vercel project
2. Click Settings → Environment Variables
3. Add these **Production-only** variables:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `SUPABASE_ACCESS_TOKEN` | Your access token | Production |
| `SUPABASE_PROJECT_REF` | Your project ref | Production |
| `SUPABASE_DB_PASSWORD` | Your database password | Production |

⚠️ **Important:** Set these for **Production only**, not Preview or Development.

#### Via Vercel CLI

```bash
# Set production environment variables
vercel env add SUPABASE_ACCESS_TOKEN production
# Paste your access token when prompted

vercel env add SUPABASE_PROJECT_REF production
# Paste your project reference ID

vercel env add SUPABASE_DB_PASSWORD production
# Paste your database password
```

### 3. Deploy

That's it! Next deployment will automatically run migrations.

```bash
# Push to main branch
git push origin main

# Or deploy directly
vercel --prod
```

## Monitoring Migrations

### View Migration Logs

1. Go to Vercel Dashboard → Deployments
2. Click on your deployment
3. Click "Build Logs"
4. Look for the migration output:

```
🔍 Checking environment variables...
✅ All required environment variables present

🔍 Checking Supabase CLI...
✅ Supabase CLI is installed

🔗 Linking Supabase project...
✅ Successfully linked to Supabase project

🚀 Running migrations...
▶️  Applying migrations...
✅ Migrations applied successfully!
```

### If Migrations Fail

The build will fail with error details. Common issues:

**"Missing required environment variables"**
- Solution: Add the required variables in Vercel dashboard

**"Failed to link Supabase project"**
- Check: SUPABASE_PROJECT_REF is correct
- Check: SUPABASE_ACCESS_TOKEN is valid (not expired)

**"Migration failed"**
- Check: SQL syntax errors in migration file
- Check: Database permissions
- Check: Conflicting schema changes

## Manual Migration Options

### Option 1: Run Locally Then Deploy

```bash
# Run migrations locally first
supabase link --project-ref your-project-ref
supabase db push

# Then deploy (migrations will be skipped since already applied)
git push origin main
```

### Option 2: Disable Auto-Migrations

If you prefer to run migrations manually:

1. Update `package.json`:
```json
"scripts": {
  "build": "next build --webpack",
  "build:with-migrations": "npm run migrate && next build --webpack"
}
```

2. Update Vercel build command:
```bash
vercel --build-env SKIP_MIGRATIONS=true
```

3. Run migrations manually:
```bash
supabase db push
```

## Preview Database Setup (Optional)

To run migrations on preview deployments, set up a separate preview database:

### 1. Create Preview Project

1. Create a new Supabase project for previews
2. Note the project reference ID

### 2. Add Preview Variables

```bash
vercel env add SUPABASE_PREVIEW_PROJECT_REF preview
vercel env add SUPABASE_PREVIEW_DB_PASSWORD preview
```

### 3. Update Script

The migration script will automatically detect preview environment and use preview credentials.

## Best Practices

### ✅ Do's

- ✅ Test migrations locally before pushing
- ✅ Review migration SQL before deploying
- ✅ Use `--dry-run` to preview changes
- ✅ Keep migrations small and focused
- ✅ Name migrations descriptively
- ✅ Include rollback steps in comments
- ✅ Monitor build logs after deployment

### ❌ Don'ts

- ❌ Don't edit existing migrations (create new ones)
- ❌ Don't commit broken SQL syntax
- ❌ Don't make destructive changes without backups
- ❌ Don't skip testing on staging first
- ❌ Don't share Supabase credentials publicly

## Rollback Strategy

If a migration causes issues:

### 1. Quick Rollback (Vercel)

```bash
# Rollback to previous deployment
vercel rollback <previous-deployment-url>
```

### 2. Database Rollback (Manual)

```sql
-- Connect to Supabase SQL Editor
-- Run rollback SQL (should be documented in migration file)

-- Example rollback
DROP TABLE IF EXISTS new_table_from_migration;
ALTER TABLE modified_table DROP COLUMN new_column;
```

### 3. Create Fix Migration

```bash
# Create new migration to fix issues
supabase migration new fix_previous_migration

# Edit the SQL file
# Push to production
git add supabase/migrations/*
git commit -m "fix: rollback problematic migration"
git push origin main
```

## Troubleshooting

### Build Fails with "supabase command not found"

**Cause:** Supabase CLI not installed during build

**Solution:** Ensure `vercel.json` has:
```json
{
  "installCommand": "npm install && npm install -g supabase"
}
```

### Migrations Run on Every Build

**Expected behavior:** Supabase CLI only applies migrations that haven't been run yet.

If migrations re-run:
- Check migration files for syntax that's not idempotent
- Use `CREATE TABLE IF NOT EXISTS`
- Use `DROP POLICY IF EXISTS` before `CREATE POLICY`

### Access Token Expired

**Cause:** Supabase access tokens can expire

**Solution:**
1. Generate new token at https://supabase.com/dashboard/account/tokens
2. Update in Vercel: Settings → Environment Variables
3. Update the SUPABASE_ACCESS_TOKEN value
4. Redeploy

### Database Connection Issues

**Symptoms:** "Could not connect to database"

**Solutions:**
- Verify SUPABASE_DB_PASSWORD is correct
- Check Supabase project status (not paused)
- Verify network connectivity from Vercel
- Check Supabase pooler connection limits

### Expected Warnings in Preview Deployments

**Symptom:** Console logs show: "Auth settings columns not found (using defaults): column app_settings.sso_google_enabled does not exist"

**This is expected behavior** when:
- Code is deployed to preview/staging environment
- Migrations haven't been applied to that environment
- The code is designed to handle this gracefully

**Why this happens:**
- Preview deployments skip migrations by design (line 286 in `scripts/run-migrations.ts`)
- This prevents preview builds from modifying the production database
- The application code detects missing columns and uses default settings

**No action needed:** The application will work with default authentication settings until migrations are applied. Once deployed to production, migrations will run automatically and the warnings will stop.

## Alternative: GitHub Actions

If you prefer GitHub Actions over Vercel build hooks:

1. Use `.github/workflows/deploy-preview.yml` (already created)
2. Run migrations in CI before deploying
3. Gives more control over when/how migrations run

## Migration Checklist

Before each deployment:

- [ ] Test migration locally with `supabase db push --dry-run`
- [ ] Review SQL for destructive operations
- [ ] Ensure migration is idempotent
- [ ] Have rollback plan ready
- [ ] Notify team of schema changes
- [ ] Monitor build logs during deployment
- [ ] Verify changes in Supabase dashboard after deployment

## Security Notes

🔒 **Never commit these to Git:**
- SUPABASE_ACCESS_TOKEN
- SUPABASE_DB_PASSWORD
- SUPABASE_SERVICE_ROLE_KEY

✅ **Store only in:**
- Vercel environment variables
- GitHub Secrets (for Actions)
- Local `.env.local` (gitignored)

---

## Quick Reference

### Environment Variables for Migrations

| Variable | Used For | Where to Get It |
|----------|----------|-----------------|
| `SUPABASE_ACCESS_TOKEN` | CLI authentication | Supabase Dashboard → Account → Tokens |
| `SUPABASE_PROJECT_REF` | Project identification | Project Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | Database connection | Project Settings → Database → Password |

### NPM Scripts

```bash
# Run migrations (auto-detects environment)
npm run migrate

# Run migrations locally
npm run migrate:local

# Build with migrations (production)
npm run build

# Build without migrations (local)
npm run build:local
```

### Vercel Build Command

Set in Vercel Dashboard → Settings → Build & Development Settings:

```
Build Command: npm run build
Install Command: npm install && npm install -g supabase
```

---

**Last Updated:** February 2, 2026  
**Status:** ✅ Fully configured and tested
