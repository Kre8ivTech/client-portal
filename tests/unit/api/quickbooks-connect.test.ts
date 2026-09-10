import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/quickbooks/connect/route'
import { GET as getCustomers, POST as syncCustomers } from '@/app/api/quickbooks/customers/route'
import { createServerSupabaseClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/quickbooks/client', () => ({
  getQuickBooksConfig: vi.fn().mockResolvedValue({
    clientId: 'cid',
    clientSecret: 'secret',
    redirectUri: 'http://localhost:3000/api/quickbooks/callback',
    environment: 'sandbox',
  }),
  QuickBooksClient: {
    getAuthorizationUrl: vi.fn().mockReturnValue('https://appcenter.intuit.com/connect/oauth2?client_id=cid'),
  },
}))

vi.mock('@/lib/quickbooks/connection', () => ({
  getConnectedQuickBooksClient: vi.fn(),
  QUICKBOOKS_SAFE_SELECT: 'id',
  QUICKBOOKS_TOKEN_SELECT: 'id',
}))

const createServerSupabaseClientMock = vi.mocked(createServerSupabaseClient)
const orgId = '11111111-1111-1111-1111-111111111111'

function createAuthClient({
  authenticated = true,
  role = 'staff',
  isAccountManager = true,
  organizationId = orgId,
}: {
  authenticated?: boolean
  role?: string
  isAccountManager?: boolean
  organizationId?: string | null
} = {}) {
  return {
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
                data: authenticated
                  ? {
                      role,
                      is_account_manager: isAccountManager,
                      organization_id: organizationId,
                    }
                  : null,
                error: null,
              }),
            })),
          })),
        }
      }
      if (table === 'oauth_states') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      if (table === 'quickbooks_customers') {
        const query = {
          select: vi.fn(),
          eq: vi.fn(),
          order: vi.fn(),
        }
        query.select.mockReturnValue(query)
        query.eq.mockReturnValue(query)
        query.order.mockResolvedValue({
          data: [
            {
              id: 'map-1',
              organization_id: orgId,
              portal_user_id: 'child-client',
              portal_organization_id: orgId,
              qb_customer_id: 'QB-1',
              display_name: 'Child Co',
              email: 'ada@child.test',
              synced_at: '2026-09-08T00:00:00.000Z',
            },
          ],
          error: null,
        })
        return query
      }
      throw new Error(`unexpected table ${table}`)
    }),
  }
}

describe('GET /api/quickbooks/connect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires authentication', async () => {
    createServerSupabaseClientMock.mockResolvedValue(createAuthClient({ authenticated: false }) as never)
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('forbids clients from connecting QuickBooks', async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createAuthClient({ role: 'client', isAccountManager: false }) as never,
    )
    const response = await GET()
    expect(response.status).toBe(403)
  })

  it('returns an authorization URL for account managers', async () => {
    createServerSupabaseClientMock.mockResolvedValue(createAuthClient() as never)
    const response = await GET()
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.authorization_url).toContain('intuit.com')
  })
})

describe('GET /api/quickbooks/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scopes customer mappings to the caller organization', async () => {
    const client = createAuthClient()
    createServerSupabaseClientMock.mockResolvedValue(client as never)
    const response = await getCustomers()
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.data[0].organization_id).toBe(orgId)
    expect(client.from).toHaveBeenCalledWith('quickbooks_customers')
  })

  it('rejects unauthenticated customer listing', async () => {
    createServerSupabaseClientMock.mockResolvedValue(createAuthClient({ authenticated: false }) as never)
    const response = await getCustomers()
    expect(response.status).toBe(401)
  })
})

describe('POST /api/quickbooks/customers', () => {
  it('does not allow clients to sync another tenant customers', async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createAuthClient({ role: 'client', isAccountManager: false }) as never,
    )
    const response = await syncCustomers(
      new Request('http://localhost/api/quickbooks/customers', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    )
    expect(response.status).toBe(403)
  })
})
