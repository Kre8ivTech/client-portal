'use server'

export async function checkEncryptionConfig() {
  const secret = process.env.ENCRYPTION_SECRET
  return {
    isConfigured: !!secret && secret.length >= 8
  }
}
