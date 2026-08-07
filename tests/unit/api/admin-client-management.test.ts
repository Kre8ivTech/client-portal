import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE, PATCH } from '@/app/api/admin/clients/[id]/route'
import { writeAuditLog } from '@/lib/audit'
import { createServerSupabaseClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(),
}))

const clientId = '31784cdf-469c-4936-9219-34be1fe7fbc5'
const mainOrgId = 'd12abe39-5448-4563-9ac6-2dd53da9fcfc'
const createServerSupabaseClientMock = vi.mocked(createServerSupabaseClient)
const writeAuditLogMock = vi.mocked(writeAuditLog)

const defaultClient = {
  id: clientId,
  name: 'Acme Co',
  slug: 'acme-co',
  type: 'client',
  status: 'active',
  parent_org_id: null,
  custom_domain: null,
  custom_domain_verified: false,
}

type ClientFixtureOptions = {
  authenticated?: boolean
  role?: string
  client?: typeof defaultClient | null
  clientError?: { message: string } | null
  childClient?: { id: string } | null
  mainOrganization?: { id: string } | null
  updatedClient?: Record<string, unknown> | null
  updateError?: { message: string } | null
}

function createSupabaseFixture({
  authenticated = true,
  role = 'super_admin',
  client = defaultClient,
  clientError = null,
  childClient = null,
  mainOrganization = { id: mainOrgId },
  updatedClient,
  updateError = null,
}: ClientFixtureOptions = {}) {
  const updateMaybeSingle = vi.fn().mockResolvedValue({
    data:
      updatedClient === undefined
        ? { ...client, type: 'partner', parent_org_id: mainOrgId }
        : updatedClient,
    error: updateError,
  })
  const updateOrganization = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({ maybeSingle: updateMaybeSingle })),
    })),
  }))

  const organizations = {
    select: vi.fn((columns: string) => ({
      eq: vi.fn((column: string) => {
        if (columns === 'id' && column === 'parent_org_id') {
          return {
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: childClient, error: null }),
            })),
          }
        }

        if (columns === 'id' && column === 'type') {
          return {
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: mainOrganization, error: null }),
            })),
          }
        }

        return {
          maybeSingle: vi.fn().mockResolvedValue({ data: client, error: clientError }),
        }
      }),
    })),
    update: updateOrganization,
  }

  return {
    updateOrganization,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: authenticated ? { id: 'admin-user' } : null },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: authenticated ? { role } : null,
                  error: null,
                }),
              })),
            })),
          }
        }

        return organizations
      }),
    },
  }
}

async function patchClient(body: unknown, id = clientId) {
  return PATCH(
    new NextRequest(`http://localhost/api/admin/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )
}

async function deleteClient(id = clientId) {
  return DELETE(
    new NextRequest(`http://localhost/api/admin/clients/${id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id }) },
  )
}

describe('admin client management API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid client IDs before accessing the database', async () => {
    const response = await patchClient({ type: 'partner' }, 'not-a-uuid')

    expect(response.status).toBe(400)
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled()
  })

  it('allows only super admins to change a client role', async () => {
    const fixture = createSupabaseFixture({ role: 'staff' })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await patchClient({ type: 'partner' })

    expect(response.status).toBe(403)
    expect(fixture.updateOrganization).not.toHaveBeenCalled()
  })

  it('promotes a standard client to a white-label partner and audits the change', async () => {
    const updatedClient = {
      ...defaultClient,
      type: 'partner',
      parent_org_id: mainOrgId,
    }
    const fixture = createSupabaseFixture({ updatedClient })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await patchClient({ type: 'partner' })

    expect(response.status).toBe(200)
    expect(fixture.updateOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'partner', parent_org_id: mainOrgId }),
    )
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'client_role_updated',
        entity_id: clientId,
        old_values: expect.objectContaining({ type: 'client' }),
        new_values: expect.objectContaining({ type: 'partner' }),
      }),
    )
  })

  it('blocks disabling white-label access while the partner owns child clients', async () => {
    const fixture = createSupabaseFixture({
      client: { ...defaultClient, type: 'partner' },
      childClient: { id: '89f04a30-7d6b-4e65-9e19-18cb95615e8b' },
    })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await patchClient({ type: 'client' })

    expect(response.status).toBe(409)
    expect(fixture.updateOrganization).not.toHaveBeenCalled()
  })

  it('protects the main organization from role changes and deletion', async () => {
    const fixture = createSupabaseFixture({
      client: { ...defaultClient, type: 'kre8ivtech' },
    })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const patchResponse = await patchClient({ type: 'client' })
    const deleteResponse = await deleteClient()

    expect(patchResponse.status).toBe(409)
    expect(deleteResponse.status).toBe(409)
    expect(fixture.updateOrganization).not.toHaveBeenCalled()
  })

  it('blocks deleting a white-label partner that still owns child clients', async () => {
    const fixture = createSupabaseFixture({
      client: { ...defaultClient, type: 'partner' },
      childClient: { id: '89f04a30-7d6b-4e65-9e19-18cb95615e8b' },
    })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await deleteClient()

    expect(response.status).toBe(409)
    expect(fixture.updateOrganization).not.toHaveBeenCalled()
  })

  it('deactivates a client and records an audit event instead of destroying history', async () => {
    const fixture = createSupabaseFixture({
      updatedClient: { id: clientId, status: 'inactive' },
    })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await deleteClient()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, deletedId: clientId })
    expect(fixture.updateOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'inactive' }),
    )
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'client_deleted',
        entity_id: clientId,
        new_values: { status: 'inactive' },
        details: { deletion_mode: 'deactivated_to_preserve_history' },
      }),
    )
  })
})
