import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getStripeClient, getStripeConfig } from '@/lib/stripe'
import { triggerWebhooks } from '@/lib/zapier/webhooks'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs' // Required for webhook signature verification

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const { webhookSecret } = await getStripeConfig()

  if (!webhookSecret) {
    console.error('Stripe webhook secret is not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    const stripe = await getStripeClient()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 400 }
    )
  }


  // Use admin client for webhook handlers since there is no user session context
  const adminDb = supabaseAdmin

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionCompleted(session, adminDb)
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentIntentSucceeded(paymentIntent, adminDb)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentIntentFailed(paymentIntent, adminDb)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(invoice, adminDb)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(invoice, adminDb)
        break
      }

      default:
        // No-op for unhandled event types
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Error processing webhook:', err)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  supabase: typeof supabaseAdmin
) {
  const invoiceId = session.metadata?.invoice_id

  if (!invoiceId) {
    return
  }

  // Update invoice status to paid
  const { error } = await (supabase as any)
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: 'stripe',
      payment_reference: session.id,
      amount_paid: session.amount_total || 0,
      balance_due: 0,
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('Failed to update invoice after checkout:', error)
    throw error
  }

  // Record payment in invoice_payments table
  if (session.payment_intent && typeof session.payment_intent === 'string') {
    const { error: paymentError } = await (supabase as any).from('invoice_payments').insert({
      invoice_id: invoiceId,
      amount: session.amount_total || 0,
      payment_method: 'stripe',
      stripe_payment_intent_id: session.payment_intent,
      status: 'completed',
      paid_at: new Date().toISOString(),
    })
    if (paymentError) {
      console.error('Failed to record payment in invoice_payments:', paymentError)
    }
  }

  // Trigger webhook for invoice paid
  const { data: invoiceData } = await (supabaseAdmin as any)
    .from('invoices')
    .select('id, invoice_number, total, organization_id, status')
    .eq('id', invoiceId)
    .single()
  
  if (invoiceData) {
    triggerWebhooks('invoice.paid', invoiceData.organization_id, invoiceData)
  }

}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  supabase: typeof supabaseAdmin
) {
  const invoiceId = paymentIntent.metadata?.invoice_id

  if (!invoiceId) {
    return
  }

  const { error } = await (supabase as any)
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: 'stripe',
      payment_reference: paymentIntent.id,
      amount_paid: paymentIntent.amount,
      balance_due: 0,
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('Failed to update invoice after payment intent:', error)
    throw error
  }

}

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  supabase: typeof supabaseAdmin
) {
  const invoiceId = paymentIntent.metadata?.invoice_id

  if (!invoiceId) {
    return
  }

  console.error(`Payment failed for invoice ${invoiceId}:`, paymentIntent.last_payment_error?.message)

  // Optionally update invoice with payment failure info
  await (supabase as any)
    .from('invoices')
    .update({
      metadata: {
        last_payment_error: paymentIntent.last_payment_error?.message,
        last_payment_attempt: new Date().toISOString(),
      },
    })
    .eq('id', invoiceId)
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  supabase: typeof supabaseAdmin
) {
  const invoiceId = invoice.metadata?.invoice_id

  if (!invoiceId) {
    return
  }

  const { error } = await (supabase as any)
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      amount_paid: invoice.amount_paid,
      balance_due: 0,
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('Failed to update invoice after Stripe invoice.paid:', error)
    throw error
  }

  // Trigger webhook for invoice paid
  const { data: invoiceData } = await (supabaseAdmin as any)
    .from('invoices')
    .select('id, invoice_number, total, organization_id, status')
    .eq('id', invoiceId)
    .single()
  
  if (invoiceData) {
    triggerWebhooks('invoice.paid', invoiceData.organization_id, invoiceData)
  }

}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: typeof supabaseAdmin
) {
  const invoiceId = invoice.metadata?.invoice_id

  if (!invoiceId) {
    return
  }

  console.error(`Stripe invoice payment failed for ${invoiceId}`)

  await (supabase as any)
    .from('invoices')
    .update({
      status: 'overdue',
      metadata: {
        last_payment_error: 'Payment failed',
        last_payment_attempt: new Date().toISOString(),
      },
    })
    .eq('id', invoiceId)

  // Trigger webhook for invoice overdue
  const { data: invoiceData } = await (supabaseAdmin as any)
    .from('invoices')
    .select('id, invoice_number, total, organization_id, status')
    .eq('id', invoiceId)
    .single()
  
  if (invoiceData) {
    triggerWebhooks('invoice.overdue', invoiceData.organization_id, invoiceData)
  }
}
