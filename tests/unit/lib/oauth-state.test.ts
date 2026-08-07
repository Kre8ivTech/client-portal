import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSignedOAuthState, verifySignedOAuthState } from '@/lib/oauth-state'

describe('OAuth state signing', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('verifies state created by the application', () => {
    vi.stubEnv('OAUTH_STATE_SECRET', 'oauth-state-test-secret')
    const state = createSignedOAuthState({ userId: 'user-123', ts: 1234 })

    expect(verifySignedOAuthState(state)).toEqual({ userId: 'user-123', ts: 1234 })
  })

  it('rejects a state payload modified by the browser', () => {
    vi.stubEnv('OAUTH_STATE_SECRET', 'oauth-state-test-secret')
    const state = createSignedOAuthState({ userId: 'user-123', ts: 1234 })
    const [, signature] = state.split('.')
    const forgedPayload = Buffer.from(
      JSON.stringify({ userId: 'victim-user', ts: Date.now() }),
    ).toString('base64url')

    expect(verifySignedOAuthState(`${forgedPayload}.${signature}`)).toBeNull()
  })
})
