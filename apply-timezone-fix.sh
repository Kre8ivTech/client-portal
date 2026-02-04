#!/bin/bash

echo "Applying timezone column migration..."

# Try to push via Supabase CLI
if command -v supabase &> /dev/null; then
    echo "Using Supabase CLI to push migrations..."
    supabase db push

    if [ $? -eq 0 ]; then
        echo "✅ Migration applied successfully!"
        echo ""
        echo "Now regenerating TypeScript types..."
        supabase gen types typescript --local > src/types/database.ts
        echo "✅ Types regenerated!"
        echo ""
        echo "You can now save timezone preferences in the app."
    else
        echo "❌ Failed to push migrations via CLI."
        echo ""
        echo "Please apply manually:"
        echo "1. Go to Supabase Dashboard → SQL Editor"
        echo "2. Run the SQL from: supabase/migrations/20260204100000_user_timezone_preference.sql"
    fi
else
    echo "❌ Supabase CLI not found."
    echo ""
    echo "Please install it: npm install -g supabase"
    echo "Or apply manually via Supabase Dashboard → SQL Editor"
fi
