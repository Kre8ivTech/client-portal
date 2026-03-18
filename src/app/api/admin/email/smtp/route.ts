import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { encryptSmtpPassword } from '@/lib/notifications/providers/smtp'

const MASKED_SECRET = '****************'

const smtpSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().min(1),
  password: z.string().min(1).optional(),
  from_name: z.string().max(255).optional().nullable(),
  from_email: z.string().email().optional().nullable(),
  reply_to: z.string().email().optional().nullable(),
})

async function requireSuperAdmin() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile as { role?: string } | null)?.role
  if (role !== 'super_admin') return null

  return user
}

export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const { data } = await (admin as any)
    .from('smtp_configurations')
    .select('id, host, port, secure, username, from_name, from_email, reply_to, updated_at')
    .is('organization_id', null)
    .maybeSingle()

  return NextResponse.json({ config: data ?? null })
}

export async function POST(request: NextRequest) {
  const user = await requireSuperAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = smtpSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: existing } = await (admin as any)
    .from('smtp_configurations')
    .select('*')
    .is('organization_id', null)
    .maybeSingle()

  const input = parsed.data
  const keepExistingPassword = input.password === MASKED_SECRET || !input.password

  if (!existing && keepExistingPassword) {
    return NextResponse.json({ error: 'SMTP password is required' }, { status: 400 })
  }

  const encrypted = keepExistingPassword
    ? {
        password_encrypted: existing.password_encrypted,
        password_iv: existing.password_iv,
        password_auth_tag: existing.password_auth_tag,
        password_salt: existing.password_salt,
      }
    : encryptSmtpPassword(input.password as string)

  const payload = {
    organization_id: null,
    host: input.host,
    port: input.port,
    secure: input.secure,
    username: input.username,
    ...encrypted,
    from_name: input.from_name ?? null,
    from_email: input.from_email ?? null,
    reply_to: input.reply_to ?? null,
    updated_by: user.id,
    created_by: existing ? existing.created_by : user.id,
  }

  const query = existing
    ? (admin as any).from('smtp_configurations').update(payload).eq('id', existing.id)
    : (admin as any).from('smtp_configurations').insert(payload)

  const { error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const user = await requireSuperAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const { error } = await (admin as any)
    .from('smtp_configurations')
    .delete()
    .is('organization_id', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
