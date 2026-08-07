import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { writeAuditLog } from '@/lib/audit'
import { normalizeDashboardRole } from '@/lib/require-role'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const updateClientTypeSchema = z.object({
  type: z.enum(['client', 'partner']),
})

type UserAuthRow = {
  role: string
}

type OrganizationRow = {
  id: string
  name: string
  slug: string
  type: string
  status: string | null
  parent_org_id: string | null
  custom_domain: string | null
  custom_domain_verified: boolean | null
}

async function requireSuperAdmin() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Profile not found' }, { status: 404 }),
    }
  }

  if (normalizeDashboardRole((profile as UserAuthRow).role) !== 'super_admin') {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true as const, supabase }
}

async function loadClient(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
) {
  return supabase
    .from('organizations')
    .select(
      'id, name, slug, type, status, parent_org_id, custom_domain, custom_domain_verified',
    )
    .eq('id', organizationId)
    .maybeSingle()
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const organizationId = z.string().uuid().safeParse(id)

    if (!organizationId.success) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const input = updateClientTypeSchema.safeParse(body)

    if (!input.success) {
      return NextResponse.json(
        { error: 'Client role must be standard client or white-label partner' },
        { status: 400 },
      )
    }

    const access = await requireSuperAdmin()
    if (!access.ok) return access.response

    const { data: existingClient, error: clientError } = await loadClient(
      access.supabase,
      organizationId.data,
    )

    if (clientError) {
      console.error('Failed to load client for role update:', clientError)
      return NextResponse.json({ error: 'Failed to load client' }, { status: 500 })
    }

    const client = existingClient as OrganizationRow | null
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (client.type === 'kre8ivtech') {
      return NextResponse.json(
        { error: 'The main Kre8ivTech organization role cannot be changed' },
        { status: 409 },
      )
    }

    if (input.data.type === 'client' && client.type === 'partner') {
      const { data: childClient, error: childError } = await access.supabase
        .from('organizations')
        .select('id')
        .eq('parent_org_id', client.id)
        .limit(1)
        .maybeSingle()

      if (childError) {
        console.error('Failed to check white-label child clients:', childError)
        return NextResponse.json({ error: 'Failed to validate client role change' }, { status: 500 })
      }

      if (childClient) {
        return NextResponse.json(
          { error: 'Move or remove this partner’s child clients before disabling white-label access' },
          { status: 409 },
        )
      }
    }

    if (client.type === input.data.type) {
      return NextResponse.json({ success: true, data: client })
    }

    const updateData: Record<string, unknown> = {
      type: input.data.type,
      updated_at: new Date().toISOString(),
    }

    if (input.data.type === 'partner') {
      const { data: mainOrganization } = await access.supabase
        .from('organizations')
        .select('id')
        .eq('type', 'kre8ivtech')
        .limit(1)
        .maybeSingle()

      updateData.parent_org_id = mainOrganization?.id ?? null
    } else {
      updateData.custom_domain = null
      updateData.custom_domain_verified = false
      updateData.custom_domain_verified_at = null
    }

    const { data: updatedClient, error: updateError } = await access.supabase
      .from('organizations')
      .update(updateData)
      .eq('id', client.id)
      .select(
        'id, name, slug, type, status, parent_org_id, custom_domain, custom_domain_verified',
      )
      .maybeSingle()

    if (updateError) {
      console.error('Failed to update client role:', updateError)
      return NextResponse.json({ error: 'Failed to update client role' }, { status: 500 })
    }

    if (!updatedClient) {
      return NextResponse.json({ error: 'Client role could not be updated' }, { status: 409 })
    }

    await writeAuditLog({
      action: 'client_role_updated',
      entity_type: 'organization',
      entity_id: client.id,
      old_values: {
        type: client.type,
        parent_org_id: client.parent_org_id,
        custom_domain: client.custom_domain,
        custom_domain_verified: client.custom_domain_verified,
      },
      new_values: {
        type: input.data.type,
        parent_org_id: updatedClient.parent_org_id,
        custom_domain: updatedClient.custom_domain,
        custom_domain_verified: updatedClient.custom_domain_verified,
      },
    })

    return NextResponse.json({ success: true, data: updatedClient })
  } catch (error) {
    console.error('Client role PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const organizationId = z.string().uuid().safeParse(id)

    if (!organizationId.success) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
    }

    const access = await requireSuperAdmin()
    if (!access.ok) return access.response

    const { data: existingClient, error: clientError } = await loadClient(
      access.supabase,
      organizationId.data,
    )

    if (clientError) {
      console.error('Failed to load client for deletion:', clientError)
      return NextResponse.json({ error: 'Failed to load client' }, { status: 500 })
    }

    const client = existingClient as OrganizationRow | null
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (client.type === 'kre8ivtech') {
      return NextResponse.json(
        { error: 'The main Kre8ivTech organization cannot be deleted' },
        { status: 409 },
      )
    }

    if (client.type === 'partner') {
      const { data: childClient, error: childError } = await access.supabase
        .from('organizations')
        .select('id')
        .eq('parent_org_id', client.id)
        .limit(1)
        .maybeSingle()

      if (childError) {
        console.error('Failed to check partner child clients before deletion:', childError)
        return NextResponse.json({ error: 'Failed to validate client deletion' }, { status: 500 })
      }

      if (childClient) {
        return NextResponse.json(
          { error: 'Move or delete this partner’s child clients before deleting the partner' },
          { status: 409 },
        )
      }
    }

    const { data: deactivatedClient, error: updateError } = await access.supabase
      .from('organizations')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)
      .select('id, status')
      .maybeSingle()

    if (updateError) {
      console.error('Failed to deactivate client:', updateError)
      return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
    }

    if (!deactivatedClient) {
      return NextResponse.json({ error: 'Client could not be deleted' }, { status: 409 })
    }

    await writeAuditLog({
      action: 'client_deleted',
      entity_type: 'organization',
      entity_id: client.id,
      old_values: {
        name: client.name,
        slug: client.slug,
        type: client.type,
        status: client.status,
      },
      new_values: { status: 'inactive' },
      details: { deletion_mode: 'deactivated_to_preserve_history' },
    })

    return NextResponse.json({ success: true, deletedId: client.id })
  } catch (error) {
    console.error('Client DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
