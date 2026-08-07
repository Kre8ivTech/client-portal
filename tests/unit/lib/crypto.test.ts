import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decrypt, encrypt } from '@/lib/crypto'

describe('credential encryption', () => {
  beforeEach(() => {
    vi.stubEnv('ENCRYPTION_SECRET', 'a-secure-test-secret-that-is-longer-than-32-characters')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('round-trips AES-256-GCM ciphertext with a per-record salt', () => {
    const encrypted = encrypt('sensitive credential')

    expect(
      decrypt(
        encrypted.encryptedData,
        encrypted.iv,
        encrypted.authTag,
        encrypted.salt,
      ),
    ).toBe('sensitive credential')
  })

  it('rejects truncated authentication tags', () => {
    const encrypted = encrypt('sensitive credential')
    const truncatedTag = Buffer.from(encrypted.authTag, 'base64').subarray(0, 8).toString('base64')

    expect(() =>
      decrypt(encrypted.encryptedData, encrypted.iv, truncatedTag, encrypted.salt),
    ).toThrow('Invalid AES-GCM parameters')
  })

  it('rejects malformed salts before key derivation', () => {
    const encrypted = encrypt('sensitive credential')
    const shortSalt = Buffer.alloc(8).toString('base64')

    expect(() =>
      decrypt(encrypted.encryptedData, encrypted.iv, encrypted.authTag, shortSalt),
    ).toThrow('Invalid encryption salt length')
  })
})
