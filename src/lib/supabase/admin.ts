import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

export const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase admin environment variables are missing')
  }

  return createClient<Database>(url, key)
}

// Keeping it for backward compatibility but making it lazy if possible
// Actually it's better to just use the function everywhere.
// But I'll do a simple lazy proxy if I want to avoid massive changes.
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
)
