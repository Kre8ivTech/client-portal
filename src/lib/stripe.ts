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
  const stripe = getStripe()
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.')
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
  const stripe = getStripe()
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.')
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
  const stripe = getStripe()
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.')
  }

  await stripe.products.update(stripeProductId, { active: false })
}

/**
 * Retrieves a Stripe Product by ID
 */
export async function getStripeProduct(
  stripeProductId: string
): Promise<Stripe.Product | null> {
  const stripe = getStripe()
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
  const stripe = getStripe()
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
