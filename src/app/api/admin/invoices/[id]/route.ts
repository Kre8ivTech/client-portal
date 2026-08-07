import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { writeAuditLog } from '@/lib/audit'
import { normalizeDashboardRole } from '@/lib/require-role'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { invoiceSchema, invoiceStatusUpdateSchema, calculateInvoiceTotals } from '@/lib/validators/invoice'

type UserAuthRow = {
  organization_id: string | null
  role: string
  is_account_manager?: boolean | null
}

export async function PATCH(
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

    // Check authorization
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role, is_account_manager')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as UserAuthRow
    const isAuthorized =
      p.role === 'super_admin' ||
      (p.role === 'staff' && p.is_account_manager)

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Check if this is a simple status update or full invoice update
    const statusUpdateResult = invoiceStatusUpdateSchema.safeParse(body)

    if (statusUpdateResult.success) {
      // Simple status update
      const updateQuery = (supabase as any)
        .from('invoices')
        .update({
          status: statusUpdateResult.data.status,
          internal_notes: statusUpdateResult.data.internal_notes,
          updated_by: user.id,
        })
        .eq('id', id)
      
      if (p.organization_id) {
        updateQuery.eq('organization_id', p.organization_id)
      }
      
      const { error } = await updateQuery

      if (error) {
        console.error('Failed to update invoice status:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    // Full invoice update
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

    // Calculate totals
    const totals = calculateInvoiceTotals(data.line_items, data.tax_rate, data.discount_amount)

    // Update invoice
    const updateInvoiceQuery = (supabase as any)
      .from('invoices')
      .update({
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
        balance_due: totals.balance_due - (await getCurrentAmountPaid(supabase, id)),
        payment_terms_days: data.payment_terms_days,
        notes: data.notes,
        internal_notes: data.internal_notes,
        updated_by: user.id,
      })
      .eq('id', id)
    
    if (p.organization_id) {
      updateInvoiceQuery.eq('organization_id', p.organization_id)
    }
    
    const { data: invoice, error: updateError } = await updateInvoiceQuery
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update invoice:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Delete existing line items
    await supabase.from('invoice_line_items').delete().eq('invoice_id', id)

    // Create new line items
    const lineItemsToInsert = data.line_items.map((item) => ({
      invoice_id: id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: Math.round(item.quantity * item.unit_price),
    }))

    const { error: lineItemsError } = await (supabase as any)
      .from('invoice_line_items')
      .insert(lineItemsToInsert)

    if (lineItemsError) {
      console.error('Failed to update line items:', lineItemsError)
      return NextResponse.json({ error: 'Failed to update line items' }, { status: 500 })
    }

    return NextResponse.json({ data: invoice })
  } catch (err) {
    console.error('Invoice PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const invoiceId = z.string().uuid().safeParse(id)

    if (!invoiceId.success) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check authorization
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role, is_account_manager')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as UserAuthRow
    if (normalizeDashboardRole(p.role) !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch invoice to check status
    const { data: invoice, error: invoiceError } = await (supabase as any)
      .from('invoices')
      .select('id, invoice_number, status')
      .eq('id', invoiceId.data)
      .maybeSingle()

    if (invoiceError) {
      console.error('Failed to load invoice for deletion:', invoiceError)
      return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 })
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Don't allow deleting paid invoices
    if (invoice.status === 'paid' || invoice.status === 'partial') {
      return NextResponse.json(
        { error: 'Cannot delete paid or partially paid invoices' },
        { status: 400 }
      )
    }

    // Related line items, payments, and payment audit entries cascade in Postgres.
    const { data: deletedInvoice, error } = await (supabase as any)
      .from('invoices')
      .delete()
      .eq('id', invoiceId.data)
      .neq('status', 'paid')
      .neq('status', 'partial')
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Failed to delete invoice:', error)
      return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
    }

    if (!deletedInvoice) {
      return NextResponse.json({ error: 'Invoice could not be deleted' }, { status: 409 })
    }

    await writeAuditLog({
      action: 'invoice_deleted',
      entity_type: 'invoice',
      entity_id: deletedInvoice.id,
      old_values: {
        invoice_number: invoice.invoice_number,
        status: invoice.status,
      },
    })

    return NextResponse.json({ success: true, deletedId: deletedInvoice.id })
  } catch (err) {
    console.error('Invoice DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getCurrentAmountPaid(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  invoiceId: string
): Promise<number> {
  const { data: invoice } = await (supabase as any)
    .from('invoices')
    .select('amount_paid')
    .eq('id', invoiceId)
    .single()

  return invoice?.amount_paid || 0
}
