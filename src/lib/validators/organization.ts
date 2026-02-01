import { z } from 'zod'

// =============================================================================
// ORGANIZATION TYPE ENUMS
// =============================================================================

export const organizationTypeSchema = z.enum(['direct', 'partner', 'client'])
export const organizationStatusSchema = z.enum(['active', 'inactive', 'suspended'])

// =============================================================================
// BRANDING CONFIG SCHEMA
// =============================================================================

export const brandingConfigSchema = z.object({
  logo_url: z.string().url().optional().nullable(),
  primary_color: z.string().max(50).optional().nullable(),
  secondary_color: z.string().max(50).optional().nullable(),
  favicon_url: z.string().url().optional().nullable(),
}).optional().nullable()

// =============================================================================
// SETTINGS SCHEMA
// =============================================================================

export const organizationSettingsSchema = z.object({
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().max(50).optional().nullable(),
  billing_address: z.object({
    street: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postal_code: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
  }).optional().nullable(),
  timezone: z.string().max(50).optional().nullable(),
  default_language: z.string().max(10).optional().nullable(),
}).optional().nullable()

// =============================================================================
// CREATE ORGANIZATION SCHEMA
// =============================================================================

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  type: organizationTypeSchema,
  status: organizationStatusSchema.default('active'),
  parent_org_id: z.string().uuid().optional().nullable(),
  branding_config: brandingConfigSchema,
  settings: organizationSettingsSchema,
})

// =============================================================================
// UPDATE ORGANIZATION SCHEMA
// =============================================================================

export const updateOrganizationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255).optional(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  type: organizationTypeSchema.optional(),
  status: organizationStatusSchema.optional(),
  parent_org_id: z.string().uuid().optional().nullable(),
  branding_config: brandingConfigSchema,
  settings: organizationSettingsSchema,
})

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

export const listOrganizationsQuerySchema = z.object({
  type: organizationTypeSchema.optional(),
  status: organizationStatusSchema.optional(),
  parent_org_id: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type OrganizationType = z.infer<typeof organizationTypeSchema>
export type OrganizationStatus = z.infer<typeof organizationStatusSchema>
export type BrandingConfig = z.infer<typeof brandingConfigSchema>
export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
export type ListOrganizationsQuery = z.infer<typeof listOrganizationsQuerySchema>
