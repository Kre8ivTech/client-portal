import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/admin/invoices/clients/route'
import { createServerSupabaseClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

const createServerSupabaseClientMock = vi.mocked(createServerSupabaseClient)
const parentOrg = '11111111-1111-1111-1111-111111111111'
const childOrg = '22222222-2222-2222-2222-222222222222'

function thenable(value: unknown) {
  return {
    then: (resolve: (value: unknown) => unknown) => resolve(value),
  }
}

function createSupabaseFixture({
  authenticated = true,
  role = 'partner',
  isAccountManager = false,
}: {
  authenticated?: boolean
  role?: string
  isAccountManager?: boolean
} = {}) {
  const orgsQuery = {
    eq: vi.fn(),
    in: vi.fn(),
  }
  orgsQuery.eq.mockReturnValue(orgsQuery)
  orgsQuery.in.mockImplementation(() =>
    thenable({ data: [{ id: childOrg }], error: null }),
  )

  const usersQuery = {
    in: vi.fn(),
    order: vi.fn(),
  }
  usersQuery.in.mockReturnValue(usersQuery)
  usersQuery.order.mockImplementation(() =>
    thenable({
      data: [
        {
          id: 'child-client',
          email: 'ada@child.test',
          role: 'client',
          organization_id: childOrg,
          profiles: { name: 'Ada Client' },
          organizations: { name: 'Child Co' },
        },
      ],
      error: null,
    }),
  )

  return {
    orgsQuery,
    usersQuery,
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
            select: vi.fn((columns: string) => {
              if (columns.startsWith('id, email')) {
                return usersQuery
              }
              return {
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: authenticated
                      ? {
                          id: 'admin-user',
                          organization_id: parentOrg,
                          role,
                          is_account_manager: isAccountManager,
                        }
                      : null,
                    error: null,
                  }),
                })),
              }
            }),
          }
        }
        if (table === 'organizations') {
          return { select: vi.fn(() => orgsQuery) }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    },
  }
}

describe('GET /api/admin/invoices/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires authentication', async () => {
    const fixture = createSupabaseFixture({ authenticated: false })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('forbids clients from listing billable clients', async () => {
    const fixture = createSupabaseFixture({ role: 'client' })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await GET()
    expect(response.status).toBe(403)
  })

  it('lets a parent-org partner list child-org clients', async () => {
    const fixture = createSupabaseFixture({ role: 'partner' })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual([
      {
        id: 'child-client',
        email: 'ada@child.test',
        organization_id: childOrg,
        full_name: 'Ada Client',
        organization_name: 'Child Co',
      },
    ])
    expect(fixture.orgsQuery.eq).toHaveBeenCalledWith('parent_org_id', parentOrg)
  })
})
