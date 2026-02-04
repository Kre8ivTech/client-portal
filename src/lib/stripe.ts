import Stripe from 'stripe'
import { getSupabaseAdmin } from './supabase/admin'

const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Retrieves Stripe configuration from database or environment variables
 */
export async function getStripeConfig() {
  const supabase = getSupabaseAdmin()
  const { data: settings } = await (supabase as any)
    .from('app_settings')
    .select('*')
    .eq('id', APP_SETTINGS_ID)
    .single()

  const mode = settings?.stripe_mode || (process.env.NODE_ENV === 'production' ? 'live' : 'test')
  
  const secretKey = mode === 'live'
    ? (settings?.stripe_live_secret_key || process.env.STRIPE_SECRET_KEY)
    : (settings?.stripe_test_secret_key || process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY)
    
  const webhookSecret = mode === 'live'
    ? (settings?.stripe_live_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET)
    : (settings?.stripe_test_webhook_secret || process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET)

  return {
    mode,
    secretKey,
    webhookSecret,
    isConfigured: Boolean(secretKey)
  }
}

/**
 * Returns a Stripe instance based on current configuration.
 */
export async function getStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeConfig()
  
  if (!secretKey) {
    throw new Error('Stripe is not configured. Please set Stripe keys in Integrations settings or environment variables.')
  }

  return new Stripe(secretKey, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
  })
}

/** Cached Stripe instance for backward compatibility */
let _stripeInstance: Stripe | null = null

/**
 * Server-side Stripe instance getter for backward compatibility.
 * Lazily initializes to avoid build-time errors.
 * Note: It's better to use getStripeClient() for dynamic configuration.
 */
export function getStripeSingleton(): Stripe | null {
  if (_stripeInstance) return _stripeInstance

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return null

  _stripeInstance = new Stripe(secretKey, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
  })
  return _stripeInstance
}

/**
 * @deprecated Use getStripeSingleton() instead.
 * This export is kept for backward compatibility but will throw if STRIPE_SECRET_KEY is not set.
 */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    const instance = getStripeSingleton()
    if (!instance) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.')
    }
    return (instance as any)[prop]
  }
})

/** Whether Stripe is configured (STRIPE_SECRET_KEY is set). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/** Returns the Stripe instance when configured, otherwise null. */
async function getStripe(): Promise<Stripe | null> {
  const { secretKey } = await getStripeConfig()
  if (!secretKey) return null
  return new Stripe(secretKey, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
  })
}

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

export type BillingInterval = 'monthly' | 'yearly' | 'one_time'

export interface CreateStripeProductInput {
  name: string
  description?: string
  monthlyFeeInCents: number
  billingInterval: BillingInterval
  features?: string[]
  metadata?: Record<string, string>
}

export interface UpdateStripeProductInput {
  stripeProductId: string
  stripePriceId?: string
  name?: string
  description?: string
  monthlyFeeInCents?: number
  billingInterval?: BillingInterval
  features?: string[]
  metadata?: Record<string, string>
}

export interface StripeProductResult {
  productId: string
  priceId: string
}

/**
 * Creates a Stripe Product and Price for a plan
 */
export async function createStripeProduct(
  input: CreateStripeProductInput
): Promise<StripeProductResult> {
  const stripe = await getStripe()
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set Stripe keys in settings.')
  }

  // Create the product
  const product = await stripe.products.create({
    name: input.name,
    description: input.description,
    metadata: {
      ...input.metadata,
      source: 'kt-portal',
    },
    ...(input.features?.length && {
      marketing_features: input.features.slice(0, 15).map((name) => ({ name })),
    }),
  })

  // Create the price based on billing interval
  let price: Stripe.Price

  if (input.billingInterval === 'one_time') {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: input.monthlyFeeInCents,
      currency: 'usd',
    })
  } else {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: input.monthlyFeeInCents,
      currency: 'usd',
      recurring: {
        interval: input.billingInterval === 'yearly' ? 'year' : 'month',
      },
    })
  }

  return {
    productId: product.id,
    priceId: price.id,
  }
}

/**
 * Updates a Stripe Product (and creates a new Price if pricing changed)
 */
export async function updateStripeProduct(
  input: UpdateStripeProductInput
): Promise<StripeProductResult> {
  const stripe = await getStripe()
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set Stripe keys in settings.')
  }

  // Update the product
  const productUpdate: Stripe.ProductUpdateParams = {}
  if (input.name !== undefined) {
    productUpdate.name = input.name
  }
  if (input.description !== undefined) {
    productUpdate.description = input.description
  }
  if (input.features !== undefined) {
    productUpdate.marketing_features = input.features
      .slice(0, 15)
      .map((name) => ({ name }))
  }
  if (input.metadata !== undefined) {
    productUpdate.metadata = {
      ...input.metadata,
      source: 'kt-portal',
    }
  }

  if (Object.keys(productUpdate).length > 0) {
    await stripe.products.update(input.stripeProductId, productUpdate)
  }

  // If price changed, create a new price (Stripe prices are immutable)
  let priceId = input.stripePriceId || ''

  if (input.monthlyFeeInCents !== undefined || input.billingInterval !== undefined) {
    // Archive the old price if it exists
    if (input.stripePriceId) {
      await stripe.prices.update(input.stripePriceId, { active: false })
    }

    // Create new price
    const billingInterval = input.billingInterval || 'monthly'
    let newPrice: Stripe.Price

    if (billingInterval === 'one_time') {
      newPrice = await stripe.prices.create({
        product: input.stripeProductId,
        unit_amount: input.monthlyFeeInCents || 0,
        currency: 'usd',
      })
    } else {
      newPrice = await stripe.prices.create({
        product: input.stripeProductId,
        unit_amount: input.monthlyFeeInCents || 0,
        currency: 'usd',
        recurring: {
          interval: billingInterval === 'yearly' ? 'year' : 'month',
        },
      })
    }

    priceId = newPrice.id
  }

  return {
    productId: input.stripeProductId,
    priceId,
  }
}

/**
 * Archives a Stripe Product (marks as inactive)
 */
export async function archiveStripeProduct(stripeProductId: string): Promise<void> {
  const stripe = await getStripe()
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set Stripe keys in settings.')
  }

  await stripe.products.update(stripeProductId, { active: false })
}

/**
 * Retrieves a Stripe Product by ID
 */
export async function getStripeProduct(
  stripeProductId: string
): Promise<Stripe.Product | null> {
  const stripe = await getStripe()
  if (!stripe) {
    return null
  }

  try {
    return await stripe.products.retrieve(stripeProductId)
  } catch (error) {
    if ((error as Stripe.errors.StripeError).code === 'resource_missing') {
      return null
    }
    throw error
  }
}

/**
 * Retrieves a Stripe Price by ID
 */
export async function getStripePrice(stripePriceId: string): Promise<Stripe.Price | null> {
  const stripe = await getStripe()
  if (!stripe) {
    return null
  }

  try {
    return await stripe.prices.retrieve(stripePriceId)
  } catch (error) {
    if ((error as Stripe.errors.StripeError).code === 'resource_missing') {
      return null
    }
    throw error
  }
}

