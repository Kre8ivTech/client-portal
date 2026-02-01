import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { invoiceSchema, calculateInvoiceTotals } from '@/lib/validators/invoice'

export async function GET(request: NextRequest) {
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

    // Check if user is admin/account manager
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role, is_account_manager')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as { organization_id: string | null; role: string; is_account_manager: boolean }
    const isAuthorized =
      p.role === 'super_admin' ||
      (p.role === 'staff' && p.is_account_manager) ||
      p.role === 'partner'

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden - Account manager access required' }, { status: 403 })
    }

    // Fetch invoices with relations
    const invoicesQuery = (supabase as any)
      .from('invoices')
      .select('*, created_by_user:users!created_by(id, email, profiles(name))')
    
    if (p.organization_id) {
      invoicesQuery.eq('organization_id', p.organization_id)
    }
    
    const { data: invoices, error } = await invoicesQuery
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch invoices:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: invoices })
  } catch (err) {
    console.error('Invoices GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    // Check if user is admin/account manager
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role, is_account_manager')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as { organization_id: string | null; role: string; is_account_manager: boolean }
    const isAuthorized =
      p.role === 'super_admin' ||
      (p.role === 'staff' && p.is_account_manager)

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden - Account manager access required' }, { status: 403 })
    }

    // Validate input
    const body = await request.json()
    const result = invoiceSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.flatten(),
        },
        { status: 400 }
      )
    }

    const data = result.data

    // Verify invoice number is unique for this org
    const existingQuery = (supabase as any)
      .from('invoices')
      .select('id')
      .eq('invoice_number', data.invoice_number)
    
    if (p.organization_id) {
      existingQuery.eq('organization_id', p.organization_id)
    }
    
    const { data: existing } = await existingQuery.single()

    if (existing) {
      return NextResponse.json(
        { error: 'Invoice number already exists' },
        { status: 400 }
      )
    }

    // Calculate totals
    const totals = calculateInvoiceTotals(data.line_items, data.tax_rate, data.discount_amount)

    // Create invoice
    const { data: invoice, error: invoiceError } = await (supabase as any)
      .from('invoices')
      .insert({
        organization_id: p.organization_id,
        invoice_number: data.invoice_number,
        status: data.status,
        issue_date: data.issue_date,
        due_date: data.due_date,
        period_start: data.period_start,
        period_end: data.period_end,
        subtotal: totals.subtotal,
        tax_rate: data.tax_rate,
        tax_amount: totals.taxAmount,
        discount_amount: data.discount_amount,
        discount_description: data.discount_description,
        total: totals.total,
        balance_due: totals.balance_due,
        amount_paid: 0,
        payment_terms_days: data.payment_terms_days,
        notes: data.notes,
        internal_notes: data.internal_notes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (invoiceError) {
      console.error('Failed to create invoice:', invoiceError)
      return NextResponse.json({ error: invoiceError.message }, { status: 500 })
    }

    // Create line items
    const lineItemsToInsert = data.line_items.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: Math.round(item.quantity * item.unit_price),
    }))

    const { error: lineItemsError } = await (supabase as any)
      .from('invoice_line_items')
      .insert(lineItemsToInsert)

    if (lineItemsError) {
      console.error('Failed to create line items:', lineItemsError)
      // Rollback: delete the invoice
      await supabase.from('invoices').delete().eq('id', invoice.id)
      return NextResponse.json({ error: 'Failed to create line items' }, { status: 500 })
    }

    return NextResponse.json({ data: invoice }, { status: 201 })
  } catch (err) {
    console.error('Invoice POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
