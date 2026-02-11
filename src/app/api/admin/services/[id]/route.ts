import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { serviceSchema } from '@/lib/validators/service'
import { updateStripeProduct, createStripeProduct, archiveStripeProduct } from '@/lib/stripe'
import { isMissingColumnError } from '@/lib/utils/error-handling'

// PATCH /api/admin/services/[id] - Update service
export async function PATCH(
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

    // Get user's org and role
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as { organization_id: string | null; role: string }
    if (!['super_admin', 'staff'].includes(p.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate request body
    const body = await request.json()
    const result = serviceSchema.partial().safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    // Non-super-admins cannot change organization ownership
    const updateData: any = { ...result.data }
    if (p.role !== 'super_admin') {
      delete updateData.organization_id
    }

    // Update service
    const updateQuery = (supabase as any)
      .from('services')
      .update(updateData)
      .eq('id', id)
    
    // Staff scoped to their org, super_admin can update across orgs
    if (p.role !== 'super_admin' && p.organization_id) {
      updateQuery.eq('organization_id', p.organization_id)
    }
    
    let service: any = null
    let error: any = null
    ;({ data: service, error } = await updateQuery.select().single())

    // Backwards-compat: retry without is_global if column doesn't exist yet.
    if (error && isMissingColumnError(error, 'is_global')) {
      const retryData = { ...updateData }
      delete retryData.is_global
      const retryQuery = (supabase as any)
        .from('services')
        .update(retryData)
        .eq('id', id)
      if (p.role !== 'super_admin' && p.organization_id) {
        retryQuery.eq('organization_id', p.organization_id)
      }
      ;({ data: service, error } = await retryQuery.select().single())
    }

    if (error) {
      console.error('Error updating service:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Sync to Stripe
    try {
      if (service.stripe_product_id) {
        // Update existing Stripe product
        const stripeResult = await updateStripeProduct({
          stripeProductId: service.stripe_product_id,
          stripePriceId: service.stripe_price_id || undefined,
          name: service.name,
          description: service.description || undefined,
          ...(result.data.base_rate !== undefined || result.data.rate_type !== undefined
            ? {
                monthlyFeeInCents: service.base_rate || 0,
                billingInterval: service.rate_type === 'hourly' ? 'monthly' as const : 'one_time' as const,
              }
            : {}),
          metadata: {
            service_id: service.id,
            category: service.category || '',
            rate_type: service.rate_type || '',
          },
        })

        // Update Stripe price ID if it changed
        if (stripeResult.priceId && stripeResult.priceId !== service.stripe_price_id) {
          await (supabase as any)
            .from('services')
            .update({ stripe_price_id: stripeResult.priceId })
            .eq('id', service.id)
          service.stripe_price_id = stripeResult.priceId
        }
      } else {
        // No Stripe product yet - create one
        const billingInterval = service.rate_type === 'hourly' ? 'monthly' : 'one_time'
        const stripeResult = await createStripeProduct({
          name: service.name,
          description: service.description || undefined,
          monthlyFeeInCents: service.base_rate || 0,
          billingInterval,
          metadata: {
            service_id: service.id,
            category: service.category || '',
            rate_type: service.rate_type || '',
          },
        })

        const { data: updatedService } = await (supabase as any)
          .from('services')
          .update({
            stripe_product_id: stripeResult.productId,
            stripe_price_id: stripeResult.priceId,
          })
          .eq('id', service.id)
          .select()
          .single()

        if (updatedService) {
          service = updatedService
        }
      }
    } catch (stripeError) {
      console.error('Stripe sync error during update:', stripeError)
      // Don't fail - service was updated, Stripe can be retried
    }

    return NextResponse.json({ data: service }, { status: 200 })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/services/[id] - Delete service
export async function DELETE(
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

    // Get user's org and role
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const p = profile as { organization_id: string | null; role: string }
    if (!['super_admin', 'staff'].includes(p.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if service has any requests
    const { count } = await supabase
      .from('service_requests')
      .select('id', { count: 'exact', head: true })
      .eq('service_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete service with existing requests. Deactivate it instead.' },
        { status: 400 }
      )
    }

    // Archive in Stripe before deleting
    const { data: serviceToDelete } = await (supabase as any)
      .from('services')
      .select('stripe_product_id')
      .eq('id', id)
      .single()

    if (serviceToDelete?.stripe_product_id) {
      try {
        await archiveStripeProduct(serviceToDelete.stripe_product_id)
      } catch (stripeError) {
        console.error('Stripe archive error:', stripeError)
        // Don't block deletion
      }
    }

    // Delete service
    const deleteQuery = (supabase as any)
      .from('services')
      .delete()
      .eq('id', id)
    
    // Staff scoped to their org, super_admin can delete across orgs
    if (p.role !== 'super_admin' && p.organization_id) {
      deleteQuery.eq('organization_id', p.organization_id)
    }
    
    const { error } = await deleteQuery

    if (error) {
      console.error('Error deleting service:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
