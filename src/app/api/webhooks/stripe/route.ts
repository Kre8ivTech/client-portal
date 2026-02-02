import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getStripeClient, getStripeConfig } from '@/lib/stripe'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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


  const supabase = await createServerSupabaseClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionCompleted(session, supabase)
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentIntentSucceeded(paymentIntent, supabase)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentIntentFailed(paymentIntent, supabase)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(invoice, supabase)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(invoice, supabase)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
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
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
) {
  const invoiceId = session.metadata?.invoice_id

  if (!invoiceId) {
    console.warn('Checkout session completed but no invoice_id in metadata')
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
    await (supabase as any).from('invoice_payments').insert({
      invoice_id: invoiceId,
      amount: session.amount_total || 0,
      payment_method: 'stripe',
      stripe_payment_intent_id: session.payment_intent,
      status: 'completed',
      paid_at: new Date().toISOString(),
    })
  }

  console.log(`Invoice ${invoiceId} marked as paid via checkout session ${session.id}`)
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
) {
  const invoiceId = paymentIntent.metadata?.invoice_id

  if (!invoiceId) {
    console.warn('Payment intent succeeded but no invoice_id in metadata')
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

  console.log(`Invoice ${invoiceId} marked as paid via payment intent ${paymentIntent.id}`)
}

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
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
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
) {
  const invoiceId = invoice.metadata?.invoice_id

  if (!invoiceId) {
    console.warn('Stripe invoice paid but no invoice_id in metadata')
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

  console.log(`Invoice ${invoiceId} marked as paid via Stripe invoice ${invoice.id}`)
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
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
}
