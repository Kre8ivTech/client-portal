import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { updatePlanSchema } from '@/lib/validators/plan'
import {
  isStripeConfigured,
  updateStripeProduct,
  archiveStripeProduct,
} from '@/lib/stripe'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Extended plan type to include Stripe fields (until migration is applied and types regenerated)
interface PlanRow {
  id: string
  name: string
  description: string | null
  billing_interval: 'monthly' | 'yearly' | 'one_time'
  monthly_fee: number
  stripe_product_id: string | null
  stripe_price_id: string | null
  features: string[] | null
  is_active: boolean | null
  [key: string]: unknown
}

/**
 * GET /api/plans/[id]
 * Get a single plan by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the plan - RLS will handle access control
    const { data: plan, error } = await supabase
      .from('plans')
      .select('*, plan_coverage_items(*)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: plan })
  } catch (err) {
    console.error('Error fetching plan:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/plans/[id]
 * Update a plan - admin only
 * Optionally syncs with Stripe if product exists
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
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

    // Only admins, staff, and partners can update plans
    if (role !== 'super_admin' && role !== 'staff' && role !== 'partner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the existing plan first
    const { data: existingPlanData, error: fetchError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Cast to extended type that includes Stripe fields
    const existingPlan = existingPlanData as unknown as PlanRow

    // Parse and validate input
    const body = await request.json()
    const result = updatePlanSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const input = result.data
    const { sync_to_stripe, features, billing_interval, ...planData } = input

    let stripeProductId = existingPlan.stripe_product_id
    let stripePriceId = existingPlan.stripe_price_id

    // Sync with Stripe if enabled and configured
    const shouldSyncStripe = sync_to_stripe !== false && isStripeConfigured && stripeProductId

    if (shouldSyncStripe && stripeProductId) {
      try {
        // Determine if price needs updating
        const priceChanged =
          (input.monthly_fee !== undefined && input.monthly_fee !== existingPlan.monthly_fee) ||
          (billing_interval !== undefined && billing_interval !== existingPlan.billing_interval)

        const stripeResult = await updateStripeProduct({
          stripeProductId,
          stripePriceId: stripePriceId ?? undefined,
          name: input.name,
          description: input.description,
          monthlyFeeInCents: priceChanged ? input.monthly_fee : undefined,
          billingInterval: priceChanged ? billing_interval : undefined,
          features: features,
        })

        stripeProductId = stripeResult.productId
        stripePriceId = stripeResult.priceId
      } catch (stripeError) {
        console.error('Stripe sync failed during update:', stripeError)
        // Continue with DB update but note the Stripe sync failure
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = { ...planData }
    if (features !== undefined) {
      updateData.features = features
    }
    if (billing_interval !== undefined) {
      updateData.billing_interval = billing_interval
    }
    if (stripePriceId !== existingPlan.stripe_price_id) {
      updateData.stripe_price_id = stripePriceId
    }

    // Update the plan in the database
    const { data: plan, error } = await supabaseAdmin
      .from('plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: plan,
      stripe_synced: shouldSyncStripe,
    })
  } catch (err) {
    console.error('Error updating plan:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/plans/[id]
 * Archive a plan (set is_active=false) - admin only
 * Does not actually delete the plan to preserve history
 * Also archives the Stripe product if it exists
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
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

    // Only admins and staff can archive plans
    if (role !== 'super_admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the existing plan first
    const { data: existingPlanData, error: fetchError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Cast to extended type that includes Stripe fields
    const existingPlan = existingPlanData as unknown as PlanRow

    // Check if plan has active assignments
    const { count: activeAssignments } = await supabase
      .from('plan_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', id)
      .in('status', ['pending', 'active', 'grace_period'])

    if (activeAssignments && activeAssignments > 0) {
      return NextResponse.json(
        {
          error: 'Cannot archive plan with active assignments',
          details: `This plan has ${activeAssignments} active assignment(s). Please cancel or migrate them first.`,
        },
        { status: 400 }
      )
    }

    // Archive in Stripe if configured and product exists
    if (isStripeConfigured && existingPlan.stripe_product_id) {
      try {
        await archiveStripeProduct(existingPlan.stripe_product_id)
      } catch (stripeError) {
        console.error('Stripe archive failed:', stripeError)
        // Continue with DB update even if Stripe fails
      }
    }

    // Archive the plan (set is_active = false)
    const { data: plan, error } = await supabaseAdmin
      .from('plans')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: plan,
      message: 'Plan archived successfully',
    })
  } catch (err) {
    console.error('Error archiving plan:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
