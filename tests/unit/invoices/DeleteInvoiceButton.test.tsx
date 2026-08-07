import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeleteInvoiceButton } from '@/components/invoices/DeleteInvoiceButton'

const { refresh, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

vi.mock('@/components/ui/use-toast', () => ({ toast }))

describe('DeleteInvoiceButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirms and deletes an unpaid invoice', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <DeleteInvoiceButton
        invoiceId="d12abe39-5448-4563-9ac6-2dd53da9fcfc"
        invoiceNumber="INV-100"
        status="draft"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete invoice INV-100?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete invoice' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/invoices/d12abe39-5448-4563-9ac6-2dd53da9fcfc',
        { method: 'DELETE', credentials: 'same-origin' },
      ),
    )
    expect(refresh).toHaveBeenCalledOnce()
    expect(toast).toHaveBeenCalledWith({ title: 'Invoice INV-100 deleted' })
  })

  it('disables deletion for paid invoices', () => {
    render(
      <DeleteInvoiceButton
        invoiceId="d12abe39-5448-4563-9ac6-2dd53da9fcfc"
        invoiceNumber="INV-100"
        status="paid"
      />,
    )

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('keeps the confirmation open and displays API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Invoice could not be deleted' }),
      }),
    )

    render(
      <DeleteInvoiceButton
        invoiceId="d12abe39-5448-4563-9ac6-2dd53da9fcfc"
        invoiceNumber="INV-100"
        status="draft"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete invoice' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invoice could not be deleted')
    expect(screen.getByText('Delete invoice INV-100?')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
})
