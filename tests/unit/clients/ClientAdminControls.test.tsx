import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientAdminControls } from '@/components/clients/ClientAdminControls'

const { push, refresh, toast } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

vi.mock('@/components/ui/use-toast', () => ({ toast }))

const clientId = '31784cdf-469c-4936-9219-34be1fe7fbc5'

describe('ClientAdminControls', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
    window.HTMLElement.prototype.releasePointerCapture = vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('changes a standard client to a white-label partner', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ClientAdminControls
        clientId={clientId}
        clientName="Acme Co"
        initialType="client"
        status="active"
      />,
    )

    const roleSelect = screen.getByRole('combobox', { name: 'Client role' })
    fireEvent.keyDown(roleSelect, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: 'White-label partner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save role' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'partner' }),
      }),
    )
    expect(refresh).toHaveBeenCalledOnce()
    expect(toast).toHaveBeenCalledWith({
      title: 'Client role updated',
      description: 'Acme Co is now a white-label partner.',
    })
  })

  it('confirms and deactivates a client while preserving history', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ClientAdminControls
        clientId={clientId}
        clientName="Acme Co"
        initialType="client"
        status="active"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete client' }))
    expect(screen.getByText('Delete Acme Co?')).toBeInTheDocument()
    expect(screen.getByText(/invoices, contracts, tickets, files, and audit history are preserved/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete client' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/admin/clients/${clientId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      }),
    )
    expect(push).toHaveBeenCalledWith('/dashboard/clients')
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('keeps the confirmation open and shows deletion errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Client could not be deleted' }),
      }),
    )

    render(
      <ClientAdminControls
        clientId={clientId}
        clientName="Acme Co"
        initialType="client"
        status="active"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete client' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete client' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Client could not be deleted')
    expect(screen.getByText('Delete Acme Co?')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('does not offer deletion again for inactive clients', () => {
    render(
      <ClientAdminControls
        clientId={clientId}
        clientName="Acme Co"
        initialType="client"
        status="inactive"
      />,
    )

    expect(screen.getByRole('button', { name: 'Client deleted' })).toBeDisabled()
  })
})
