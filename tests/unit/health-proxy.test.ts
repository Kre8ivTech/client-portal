import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { proxy } from '@/proxy'
import { updateSession } from '@/lib/supabase/middleware'

vi.mock('@/lib/supabase/middleware', () => ({ updateSession: vi.fn() }))

describe('container health check authentication boundary', () => {
  beforeEach(() => {
    vi.mocked(updateSession).mockReset()
    vi.mocked(updateSession).mockResolvedValue(NextResponse.next())
  })

  it('keeps liveness independent of the authentication provider', async () => {
    await proxy(new NextRequest('https://clients.kre8ivtech.com/api/health'))
    expect(updateSession).not.toHaveBeenCalled()
  })

  it.each(['/dashboard', '/api/contracts', '/api/health/private', '/api/health-other'])(
    'still checks authentication for %s',
    async (pathname) => {
      const request = new NextRequest(`https://clients.kre8ivtech.com${pathname}`)
      await proxy(request)
      expect(updateSession).toHaveBeenCalledWith(request)
    },
  )
})
