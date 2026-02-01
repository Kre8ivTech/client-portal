import Stripe from 'stripe'

/** Server-side Stripe instance. Requires STRIPE_SECRET_KEY at runtime. */
export const stripe: Stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    })
  : (undefined as unknown as Stripe)

// Stripe configuration constants
export const STRIPE_CONFIG = {
  currency: 'usd',
  paymentMethodTypes: ['card'] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'test',
} as const

// Helper function to format amount for Stripe (convert dollars to cents)
export function formatAmountForStripe(amount: number, currency: string = 'usd'): number {
  // Stripe expects amounts in the smallest currency unit (cents for USD)
  return Math.round(amount * 100)
}

// Helper function to format amount from Stripe (convert cents to dollars)
export function formatAmountFromStripe(amount: number, currency: string = 'usd'): number {
  return amount / 100
}
