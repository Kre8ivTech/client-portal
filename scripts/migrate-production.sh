#!/bin/bash

# Simple migration script for production deployments
# This is a fallback option if the TypeScript script has issues

set -e

echo "🚀 Starting Supabase migration process..."

# Check if we're in production
if [ "$VERCEL_ENV" != "production" ]; then
  echo "⚠️  Not in production environment (VERCEL_ENV=$VERCEL_ENV)"
  echo "   Skipping migrations"
  exit 0
fi

# Check required environment variables
if [ -z "$SUPABASE_ACCESS_TOKEN" ] || [ -z "$SUPABASE_PROJECT_REF" ]; then
  echo "⚠️  Missing required environment variables:"
  [ -z "$SUPABASE_ACCESS_TOKEN" ] && echo "   - SUPABASE_ACCESS_TOKEN"
  [ -z "$SUPABASE_PROJECT_REF" ] && echo "   - SUPABASE_PROJECT_REF"
  echo ""
  echo "ℹ️  Add these in Vercel Dashboard > Settings > Environment Variables"
  echo "   Skipping migrations (non-fatal)"
  exit 0
fi

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "📦 Installing Supabase CLI..."
  npm install -g supabase
fi

# Check if migrations directory exists
if [ ! -d "supabase/migrations" ]; then
  echo "⚠️  No migrations directory found"
  echo "   Skipping migrations"
  exit 0
fi

echo "🔗 Linking to Supabase project..."
supabase link --project-ref "$SUPABASE_PROJECT_REF"

echo "📋 Checking for pending migrations..."
supabase db push --dry-run || true

echo "▶️  Applying migrations..."
supabase db push

echo "✅ Migrations completed successfully!"
