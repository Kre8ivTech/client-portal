import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE } from '@/app/api/admin/tickets/[id]/route'
import { writeAuditLog } from '@/lib/audit'
import { createServerSupabaseClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(),
}))

const ticketId = 'd12abe39-5448-4563-9ac6-2dd53da9fcfc'
const createServerSupabaseClientMock = vi.mocked(createServerSupabaseClient)
const writeAuditLogMock = vi.mocked(writeAuditLog)

type TicketFixture = {
  authenticated?: boolean
  role?: string
  ticket?: {
    id: string
    ticket_number: number
    subject: string
    status: string
    organization_id: string
  } | null
  deletedTicket?: { id: string } | null
  ticketError?: { message: string } | null
  deleteError?: { message: string } | null
}

function createSupabaseFixture({
  authenticated = true,
  role = 'super_admin',
  ticket = {
    id: ticketId,
    ticket_number: 42,
    subject: 'Cannot access account',
    status: 'open',
    organization_id: '89f04a30-7d6b-4e65-9e19-18cb95615e8b',
  },
  deletedTicket = { id: ticketId },
  ticketError = null,
  deleteError = null,
}: TicketFixture = {}) {
  const deleteMaybeSingle = vi.fn().mockResolvedValue({
    data: deletedTicket,
    error: deleteError,
  })
  const deleteTicket = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({ maybeSingle: deleteMaybeSingle })),
    })),
  }))

  return {
    deleteTicket,
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

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: ticket, error: ticketError }),
            })),
          })),
          delete: deleteTicket,
        }
      }),
    },
  }
}

async function deleteTicket(id = ticketId) {
  return DELETE(
    new NextRequest(`http://localhost/api/admin/tickets/${id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id }) },
  )
}

describe('DELETE /api/admin/tickets/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid ticket IDs before accessing the database', async () => {
    const response = await deleteTicket('not-a-uuid')

    expect(response.status).toBe(400)
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled()
  })

  it('requires authentication', async () => {
    const fixture = createSupabaseFixture({ authenticated: false })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await deleteTicket()

    expect(response.status).toBe(401)
  })

  it('does not allow staff to delete tickets', async () => {
    const fixture = createSupabaseFixture({ role: 'staff' })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await deleteTicket()

    expect(response.status).toBe(403)
    expect(fixture.deleteTicket).not.toHaveBeenCalled()
  })

  it('returns 404 when the ticket does not exist', async () => {
    const fixture = createSupabaseFixture({ ticket: null })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await deleteTicket()

    expect(response.status).toBe(404)
    expect(fixture.deleteTicket).not.toHaveBeenCalled()
  })

  it('deletes a ticket for legacy admin roles and records an audit event', async () => {
    const fixture = createSupabaseFixture({ role: 'admin' })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await deleteTicket()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, deletedId: ticketId })
    expect(fixture.deleteTicket).toHaveBeenCalledOnce()
    expect(writeAuditLogMock).toHaveBeenCalledWith({
      action: 'ticket_deleted',
      entity_type: 'ticket',
      entity_id: ticketId,
      old_values: {
        ticket_number: 42,
        subject: 'Cannot access account',
        status: 'open',
        organization_id: '89f04a30-7d6b-4e65-9e19-18cb95615e8b',
      },
    })
  })

  it('does not audit when deletion fails', async () => {
    const fixture = createSupabaseFixture({ deleteError: { message: 'constraint error' } })
    createServerSupabaseClientMock.mockResolvedValue(fixture.client as never)

    const response = await deleteTicket()

    expect(response.status).toBe(500)
    expect(writeAuditLogMock).not.toHaveBeenCalled()
  })
})
