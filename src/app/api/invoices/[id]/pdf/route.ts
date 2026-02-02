import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import * as React from 'react'

// Note: PDF generation requires @react-pdf/renderer packageRun: npm install @react-pdf/renderer
// This is a placeholder that will be implemented when the package is installed

export const runtime = 'nodejs' // Required for PDF generation

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const { data: invoice, error: invoiceError } = await (supabase as any)
      .from('invoices')
      .select(`
        *,
        organization:organizations(name, metadata),
        line_items:invoice_line_items(*)
      `)
      .eq('id', id)
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

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as { organization_id: string | null; role: string }
    if (p.organization_id !== invoice.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Generate PDF
    const { renderToStream } = await import('@react-pdf/renderer')
    const { InvoicePDF } = await import('@/components/invoices/pdf-template')
    
    const stream = await renderToStream(
      React.createElement(InvoicePDF, {
        invoice: invoice,
        organization: invoice.organization
      }) as any
    )

    // Return as stream
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
