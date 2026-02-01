import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createPlanSchema, listPlansQuerySchema } from '@/lib/validators/plan'
import {
  isStripeConfigured,
  createStripeProduct,
} from '@/lib/stripe'

/**
 * GET /api/plans
 * List plans - admins see all, others see available active plans
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role
    const { data: userRow } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    const role = (userRow as { role?: string } | null)?.role ?? 'client'
    const orgId = (userRow as { organization_id?: string } | null)?.organization_id

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams: Record<string, unknown> = {}

    const isActiveParam = searchParams.get('is_active')
    if (isActiveParam !== null) {
      queryParams.is_active = isActiveParam === 'true'
    }

    const isTemplateParam = searchParams.get('is_template')
    if (isTemplateParam !== null) {
      queryParams.is_template = isTemplateParam === 'true'
    }

    const searchParam = searchParams.get('search')
    if (searchParam) {
      queryParams.search = searchParam
    }

    const limitParam = searchParams.get('limit')
    if (limitParam) {
      queryParams.limit = parseInt(limitParam, 10)
    }

    const offsetParam = searchParams.get('offset')
    if (offsetParam) {
      queryParams.offset = parseInt(offsetParam, 10)
    }

    const result = listPlansQuerySchema.safeParse(queryParams)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const query = result.data
    const isAdmin = role === 'super_admin' || role === 'staff'

    // Build the query
    let dbQuery = supabase
      .from('plans')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Non-admins only see active plans for their org or global templates
    if (!isAdmin) {
      dbQuery = dbQuery
        .eq('is_active', true)
        .or(`organization_id.is.null,organization_id.eq.${orgId}`)
    } else {
      // Admins can filter by is_active
      if (query.is_active !== undefined) {
        dbQuery = dbQuery.eq('is_active', query.is_active)
      }
    }

    // Filter by is_template if specified
    if (query.is_template !== undefined) {
      dbQuery = dbQuery.eq('is_template', query.is_template)
    }

    // Search by name
    if (query.search) {
      dbQuery = dbQuery.ilike('name', `%${query.search}%`)
    }

    // Price filters
    if (query.min_monthly_fee !== undefined) {
      dbQuery = dbQuery.gte('monthly_fee', query.min_monthly_fee)
    }
    if (query.max_monthly_fee !== undefined) {
      dbQuery = dbQuery.lte('monthly_fee', query.max_monthly_fee)
    }

    // Pagination
    dbQuery = dbQuery.range(query.offset, query.offset + query.limit - 1)

    const { data: plans, error, count } = await dbQuery

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: plans,
      meta: {
        total: count ?? 0,
        limit: query.limit,
        offset: query.offset,
      },
    })
  } catch (err) {
    console.error('Error listing plans:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/plans
 * Create a new plan - admin only
 * Optionally syncs with Stripe to create Product and Price
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role
    const { data: userRow } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    const role = (userRow as { role?: string } | null)?.role ?? 'client'
    const orgId = (userRow as { organization_id?: string } | null)?.organization_id

    // Only admins and staff can create plans
    if (role !== 'super_admin' && role !== 'staff' && role !== 'partner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse and validate input
    const body = await request.json()
    const result = createPlanSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const input = result.data
    const { sync_to_stripe, features, billing_interval, ...planData } = input

    let stripeProductId: string | null = null
    let stripePriceId: string | null = null

    // Sync with Stripe if enabled and configured
    if (sync_to_stripe && isStripeConfigured) {
      try {
        const stripeResult = await createStripeProduct({
          name: input.name,
          description: input.description,
          monthlyFeeInCents: input.monthly_fee,
          billingInterval: billing_interval,
          features: features,
          metadata: {
            organization_id: orgId ?? 'global',
          },
        })
        stripeProductId = stripeResult.productId
        stripePriceId = stripeResult.priceId
      } catch (stripeError) {
        console.error('Stripe sync failed:', stripeError)
        // Return error instead of continuing without Stripe sync
        return NextResponse.json(
          {
            error: 'Failed to create Stripe product',
            details: stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error',
          },
          { status: 500 }
        )
      }
    }

    // Create the plan in the database
    // Use admin client to bypass RLS for creation if needed
    const { data: plan, error } = await supabaseAdmin
      .from('plans')
      .insert({
        ...planData,
        billing_interval,
        features,
        organization_id: role === 'super_admin' || role === 'staff' ? null : orgId,
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
      })
      .select()
      .single()

    if (error) {
      // If DB insert fails and we created Stripe product, we should ideally clean up
      // but for now we'll just log it
      if (stripeProductId) {
        console.error('DB insert failed after Stripe product creation:', stripeProductId)
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        data: plan,
        stripe_synced: !!stripeProductId,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Error creating plan:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
