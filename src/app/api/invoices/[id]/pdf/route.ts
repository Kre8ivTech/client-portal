import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Note: PDF generation requires @react-pdf/renderer package
// Run: npm install @react-pdf/renderer
// This is a placeholder that will be implemented when the package is installed

export const runtime = 'nodejs' // Required for PDF generation

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        organization:organizations(name, metadata),
        line_items:invoice_line_items(*)
      `)
      .eq('id', params.id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Verify access
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.organization_id !== invoice.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // TODO: Generate PDF using @react-pdf/renderer
    // For now, return a placeholder response
    return NextResponse.json({
      error: 'PDF generation not yet implemented',
      message: 'Install @react-pdf/renderer and implement PDF template',
    }, { status: 501 })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
