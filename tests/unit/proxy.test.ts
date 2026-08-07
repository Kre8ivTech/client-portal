import { describe, expect, it } from 'vitest'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config } from '@/proxy'

describe('Next.js security proxy matcher', () => {
  it('runs for dashboard and API routes', () => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/dashboard' })).toBe(true)
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/api/contracts' })).toBe(true)
  })

  it('skips immutable framework and image assets', () => {
    expect(
      unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/_next/static/chunks/app.js' }),
    ).toBe(false)
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/logo.png' })).toBe(false)
  })
})
