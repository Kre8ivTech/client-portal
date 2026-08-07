import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE } from '@/app/api/admin/invoices/[id]/route'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(),
}))

const invoiceId = 'd12abe39-5448-4563-9ac6-2dd53da9fcfc'
const createServerSupabaseClientMock = vi.mocked(createServerSupabaseClient)
const writeAuditLogMock = vi.mocked(writeAuditLog)

type SupabaseFixture = {
  authenticated?: boolean
  role?: string
  invoice?: { id: string; invoice_number: string; status: string } | null
  deletedInvoice?: { id: string } | null
}

function createSupabaseFixture({
  authenticated = true,
  role = 'super_admin',
  invoice = { id: invoiceId, invoice_number: 'INV-100', status: 'draft' },
  deletedInvoice = { id: invoiceId },
}: SupabaseFixture = {}) {
  const deleteMaybeSingle = vi.fn().mockResolvedValue({ data: deletedInvoice, error: null })
  const deleteQuery = {
    neq: vi.fn(),
    select: vi.fn(() => ({ maybeSingle: deleteMaybeSingle })),
  }
  deleteQuery.neq.mockImplementation(() => deleteQuery)
  const deleteInvoice = vi.fn(() => ({
    eq: vi.fn(() => deleteQuery),
  }))

  return {
    deleteInvoice,
    deleteQuery,
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
                  data: authenticated
                    ? { organization_id: null, role, is_account_manager: true }
                    : null,
                  error: null,
                }),
              })),
            })),
          }
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: invoice, error: null }),
            })),
          })),
          delete: deleteInvoice,
        }
      }),
    },
  }
}

async function deleteInvoice(id = invoiceId) {
  return DELETE(
    new NextRequest(`http://localhost/api/admin/invoices/${id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id }) },
  )
}

describe('DELETE /api/admin/invoices/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid invoice IDs before accessing the database', async () => {
    const response = await deleteInvoice('not-a-uuid')

    expect(response.status).toBe(400)
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled()
  })

  it('requires authentication', async () => {
    const fixture = createSupabaseFixture({ authenticated: false })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await deleteInvoice()

    expect(response.status).toBe(401)
  })

  it('does not allow account managers to delete invoices', async () => {
    const fixture = createSupabaseFixture({ role: 'staff' })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await deleteInvoice()

    expect(response.status).toBe(403)
    expect(fixture.deleteInvoice).not.toHaveBeenCalled()
  })

  it('does not delete paid invoices', async () => {
    const fixture = createSupabaseFixture({
      invoice: { id: invoiceId, invoice_number: 'INV-100', status: 'paid' },
    })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await deleteInvoice()

    expect(response.status).toBe(400)
    expect(fixture.deleteInvoice).not.toHaveBeenCalled()
  })

  it('deletes an unpaid invoice for legacy admin roles and records an audit event', async () => {
    const fixture = createSupabaseFixture({ role: 'admin' })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await deleteInvoice()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, deletedId: invoiceId })
    expect(fixture.deleteInvoice).toHaveBeenCalledOnce()
    expect(fixture.deleteQuery.neq).toHaveBeenNthCalledWith(1, 'status', 'paid')
    expect(fixture.deleteQuery.neq).toHaveBeenNthCalledWith(2, 'status', 'partial')
    expect(writeAuditLogMock).toHaveBeenCalledWith({
      action: 'invoice_deleted',
      entity_type: 'invoice',
      entity_id: invoiceId,
      old_values: { invoice_number: 'INV-100', status: 'draft' },
    })
  })

  it('does not delete or audit an invoice that becomes paid during deletion', async () => {
    const fixture = createSupabaseFixture({ deletedInvoice: null })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await deleteInvoice()

    expect(response.status).toBe(409)
    expect(writeAuditLogMock).not.toHaveBeenCalled()
  })
})
