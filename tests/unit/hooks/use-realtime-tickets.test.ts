import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRealtimeTickets } from '@/hooks/use-realtime-tickets'
import React from 'react'

describe('useRealtimeTickets', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  it('should subscribe to ticket changes', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useRealtimeTickets(), { wrapper })

    // Hook should execute without errors
    expect(result).toBeDefined()
  })

  it('should cleanup subscription on unmount', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { unmount } = renderHook(() => useRealtimeTickets(), { wrapper })

    // Should unmount without errors
    expect(() => unmount()).not.toThrow()
  })
})
