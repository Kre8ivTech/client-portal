import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()

  // Sign out the user
  const { error } = await supabase.auth.signOut()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/login`, {
    status: 303, // See Other - prevents some caching issues on redirects after POST
  })
}
