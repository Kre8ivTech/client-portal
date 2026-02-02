import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe'

export async function POST(
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

    // Fetch the invoice
    const { data: invoice, error: invoiceError } = await (supabase as any)
      .from('invoices')
      .select('*, organization:organizations(id, name)')
      .eq('id', id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Verify user can access this invoice
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

    // Check if invoice can be paid
    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 })
    }

    if (invoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Invoice is cancelled' }, { status: 400 })
    }

    if (invoice.balance_due <= 0) {
      return NextResponse.json({ error: 'No balance due on this invoice' }, { status: 400 })
    }

    // Get invoice line items for display
    const { data: lineItems } = await (supabase as any)
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('created_at', { ascending: true })

    // Create Stripe checkout session
    const stripe = await getStripeClient()
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems?.map((item: any) => ({
        price_data: {
          currency: invoice.currency.toLowerCase(),
          product_data: {
            name: item.description,
          },
          unit_amount: item.unit_price,
        },
        quantity: Math.round(item.quantity * 100) / 100, // Ensure valid quantity
      })) || [],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/invoices/${invoice.id}?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/invoices/${invoice.id}?payment=cancelled`,
      metadata: {
        invoice_id: invoice.id,
        organization_id: invoice.organization_id,
        user_id: user.id,
      },
      customer_email: user.email,
      client_reference_id: invoice.invoice_number,
    })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (err) {
    console.error('Checkout session creation error:', err)
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to create checkout session'
      },
      { status: 500 }
    )
  }
}
