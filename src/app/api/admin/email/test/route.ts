import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendRawEmail } from '@/lib/notifications/providers/email'
import { requireRole } from '@/lib/require-role'
import { z } from 'zod'

const testEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  template: z.string().max(50000).optional(),
  subject: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userProfile = profile as { role: string }

    if (userProfile.role !== 'super_admin' && userProfile.role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validation = testEmailSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { email, template, subject } = validation.data

    const result = await sendRawEmail({
      to: email,
      subject: subject || 'Test Email from Client Portal',
      html: template || `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1>Test Email</h1>
          <p>This is a test email sent from the Client Portal admin settings.</p>
          <p>If you received this, your email configuration is working correctly!</p>
          <br/>
          <p>Sent by: ${user.email}</p>
          <p>Time: ${new Date().toLocaleString()}</p>
        </div>
      `,
      text: 'This is a test email from Client Portal. Please view in an HTML-compatible email client.'
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Test email error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
