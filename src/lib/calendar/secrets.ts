import { encrypt, decrypt } from '@/lib/crypto'

type EncryptedPayload = {
  encryptedData: string
  iv: string
  authTag: string
}

export function encryptSecret(value: string) {
  const payload = encrypt(value)
  return JSON.stringify(payload)
}

export function decryptSecret(value: string | null) {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as EncryptedPayload
    if (!parsed.encryptedData || !parsed.iv || !parsed.authTag) return null
    return decrypt(parsed.encryptedData, parsed.iv, parsed.authTag)
  } catch {
    return null
  }
}
