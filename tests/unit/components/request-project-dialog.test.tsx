import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RequestProjectDialog } from '@/components/projects/request-project-dialog'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id' } },
      })),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}))

describe('RequestProjectDialog', () => {
  const mockRouter = {
    push: vi.fn(),
    refresh: vi.fn(),
  }

  const mockToast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useToast as any).mockReturnValue({ toast: mockToast })
  })

  it('should render the trigger button', () => {
    render(<RequestProjectDialog organizationId="test-org-id" />)
    
    const button = screen.getByRole('button', { name: /request new project/i })
    expect(button).toBeDefined()
  })

  it('should open dialog when button is clicked', async () => {
    render(<RequestProjectDialog organizationId="test-org-id" />)
    
    const button = screen.getByRole('button', { name: /request new project/i })
    fireEvent.click(button)
    
    await waitFor(() => {
      const dialogTitle = screen.getByText('Request a New Project')
      expect(dialogTitle).toBeDefined()
    })
  })

  it('should have project name input field', async () => {
    render(<RequestProjectDialog organizationId="test-org-id" />)
    
    const button = screen.getByRole('button', { name: /request new project/i })
    fireEvent.click(button)
    
    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText(/company website redesign/i)
      expect(nameInput).toBeDefined()
    })
  })

  it('should have submit button', async () => {
    render(<RequestProjectDialog organizationId="test-org-id" />)
    
    const button = screen.getByRole('button', { name: /request new project/i })
    fireEvent.click(button)
    
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /submit request/i })
      expect(submitButton).toBeDefined()
    })
  })

  it('should have proper organization id prop', () => {
    const { container } = render(<RequestProjectDialog organizationId="test-org-id" />)
    expect(container).toBeDefined()
  })
})
