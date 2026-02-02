'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type CreateInvoiceData = {
  organization_id: string
  client_id?: string // Invoices might be linked to a client via metadata or a future relationship
  invoice_number: string
  issue_date: string
  due_date: string
  notes?: string
  line_items: {
    description: string
    quantity: number
    unit_price: number // in cents
    amount: number // in cents
  }[]
}

export async function createInvoice(data: CreateInvoiceData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Calculate totals
  const subtotal = data.line_items.reduce((sum, item) => sum + item.amount, 0)
  const total = subtotal // Add tax/discount logic later if needed

  // Create invoice
  const { data: invoice, error: invoiceError } = await (supabase as any)
    .from('invoices')
    .insert({
      organization_id: data.organization_id,
      invoice_number: data.invoice_number,
      issue_date: data.issue_date,
      due_date: data.due_date,
      subtotal,
      total,
      balance_due: total,
      notes: data.notes,
      created_by: user.id,
      status: 'draft',
      metadata: {
        client_id: data.client_id
      }
    })
    .select()
    .single()

  if (invoiceError) {
    console.error('Error creating invoice:', invoiceError)
    return { error: invoiceError.message }
  }

  // Create line items
  const lineItems = data.line_items.map((item, index) => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    amount: item.amount,
    sort_order: index
  }))

  const { error: itemsError } = await (supabase as any)
    .from('invoice_line_items')
    .insert(lineItems)

  if (itemsError) {
    console.error('Error creating line items:', itemsError)
    // Should probably delete the invoice if this fails, or leave it incomplete
    return { error: itemsError.message }
  }

  revalidatePath('/dashboard/admin/invoices')
  return { success: true, id: invoice.id }
}
