import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeleteTicketButton } from '@/components/tickets/DeleteTicketButton'

const { refresh, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

vi.mock('@/components/ui/use-toast', () => ({ toast }))

describe('DeleteTicketButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirms and deletes a ticket', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    })
    const onDeleted = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(
      <DeleteTicketButton
        ticketId="d12abe39-5448-4563-9ac6-2dd53da9fcfc"
        ticketNumber={42}
        subject="Cannot access account"
        onDeleted={onDeleted}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete ticket #42?')).toBeInTheDocument()
    expect(screen.getByText(/Cannot access account/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete ticket' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/tickets/d12abe39-5448-4563-9ac6-2dd53da9fcfc',
        { method: 'DELETE', credentials: 'same-origin' },
      ),
    )
    expect(onDeleted).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledOnce()
    expect(toast).toHaveBeenCalledWith({ title: 'Ticket #42 deleted' })
  })

  it('keeps the confirmation open and displays API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Ticket could not be deleted' }),
      }),
    )

    render(
      <DeleteTicketButton
        ticketId="d12abe39-5448-4563-9ac6-2dd53da9fcfc"
        ticketNumber={42}
        subject="Cannot access account"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete ticket' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ticket could not be deleted')
    expect(screen.getByText('Delete ticket #42?')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
})
