import { z } from 'zod'

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

const normalizeRequiredString = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  return value
}

export const createVaultItemSchema = z.object({
  label: z.preprocess(normalizeOptionalString, z.string().min(1).max(255)),
  description: z.preprocess(
    normalizeOptionalString,
    z.string().max(2000).optional()
  ),
  service_url: z.preprocess(
    normalizeOptionalString,
    z.string().url().max(500).optional()
  ),
  username: z.preprocess(
    normalizeOptionalString,
    z.string().max(255).optional()
  ),
  password: z.preprocess(normalizeRequiredString, z.string().min(1).max(500)),
})

export type CreateVaultItemInput = z.infer<typeof createVaultItemSchema>
