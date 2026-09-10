'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { triggerWebhooks } from '@/lib/zapier/webhooks'
import { isInvoiceCreator, loadBillableClients } from '@/lib/invoices/billable-clients'
import { notifyInvoiceCreated } from './invoice-notifications'
import { maybeAutoSyncInvoiceToQuickBooks } from '@/lib/quickbooks/sync-invoice'

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

  const { data: profile } = await supabase
    .from('users')
    .select('id, organization_id, role, is_account_manager')
    .eq('id', user.id)
    .single()

  const creator = profile as {
    id: string
    organization_id: string | null
    role: string
    is_account_manager: boolean
  } | null

  if (!creator || !isInvoiceCreator(creator) || !creator.organization_id) {
    return { error: 'Forbidden - Account manager access required' }
  }

  if (!data.client_id) {
    return { error: 'Client is required' }
  }

  const billableClients = await loadBillableClients(supabase, creator, user.id)
  const billedClient = billableClients.find((client) => client.id === data.client_id)
  if (!billedClient) {
    return { error: 'Selected client is not in your billing scope' }
  }

  const issuerOrganizationId = creator.organization_id

  // Calculate totals
  const subtotal = data.line_items.reduce((sum, item) => sum + item.amount, 0)
  const total = subtotal // Add tax/discount logic later if needed

  // Create invoice on the issuer org so admin lists and QuickBooks stay scoped to the books owner.
  const { data: invoice, error: invoiceError } = await (supabase as any)
    .from('invoices')
    .insert({
      organization_id: issuerOrganizationId,
      client_id: data.client_id,
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
        client_id: data.client_id,
        billed_organization_id: billedClient.organization_id,
        billed_organization_name: billedClient.organization_name,
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

  // Trigger webhook for invoice creation
  triggerWebhooks('invoice.created', issuerOrganizationId, invoice)
  maybeAutoSyncInvoiceToQuickBooks(invoice.id).catch(() => {})

  // Fire-and-forget email notification
  notifyInvoiceCreated(invoice.id).catch(() => {})

  revalidatePath('/dashboard/admin/invoices')
  return { success: true, id: invoice.id }
}
