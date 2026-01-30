import { z } from 'zod'

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

export const updateProfileSchema = z.object({
  name: z.preprocess(normalizeString, z.string().min(1).max(200)),
  avatar_url: z.preprocess(
    normalizeString,
    z.string().url().max(500).optional()
  ),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
