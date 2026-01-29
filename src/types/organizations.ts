/**
 * Organization Types for KT-Portal
 */

// Organization type (tenant type)
export type OrganizationType = 'kre8ivtech' | 'partner' | 'client'

// Organization status
export type OrganizationStatus = 'active' | 'inactive' | 'suspended'

// Branding configuration
export interface BrandingConfig {
  logo_url?: string
  favicon_url?: string
  primary_color?: string
  secondary_color?: string
  font_family?: string
  custom_css?: string
}

// Organization settings
export interface OrganizationSettings {
  default_payment_terms?: string
  timezone?: string
  business_hours?: {
    monday?: { start: string; end: string }
    tuesday?: { start: string; end: string }
    wednesday?: { start: string; end: string }
    thursday?: { start: string; end: string }
    friday?: { start: string; end: string }
    saturday?: { start: string; end: string }
    sunday?: { start: string; end: string }
  }
  notifications?: {
    email_enabled?: boolean
    sms_enabled?: boolean
  }
}

// Database row type
export interface Organization {
  id: string
  name: string
  slug: string
  type: OrganizationType
  parent_org_id: string | null
  status: OrganizationStatus
  branding_config: BrandingConfig
  custom_domain: string | null
  custom_domain_verified: boolean
  custom_domain_verified_at: string | null
  settings: OrganizationSettings
  created_at: string
  updated_at: string
}

// Organization with expanded relations
export interface OrganizationWithRelations extends Organization {
  parent_organization?: {
    id: string
    name: string
    slug: string
  }
  child_organizations?: Organization[]
  members_count?: number
  active_tickets_count?: number
  pending_invoices_count?: number
}

// Profile/User associated with organization
export interface OrganizationMember {
  id: string
  organization_id: string
  email: string
  name: string | null
  avatar_url: string | null
  role: 'super_admin' | 'staff' | 'partner' | 'partner_staff' | 'client'
  status: 'active' | 'inactive' | 'invited' | 'suspended'
  presence_status: 'online' | 'offline' | 'away' | 'dnd'
  last_seen_at: string | null
  created_at: string
}

// Input types
export interface CreateOrganizationInput {
  name: string
  slug: string
  type: OrganizationType
  parent_org_id?: string
}

export interface UpdateOrganizationInput {
  name?: string
  slug?: string
  status?: OrganizationStatus
  branding_config?: Partial<BrandingConfig>
  settings?: Partial<OrganizationSettings>
  custom_domain?: string | null
}

export interface InviteMemberInput {
  email: string
  name?: string
  role: 'partner' | 'partner_staff' | 'client'
}

// Filter options
export interface OrganizationFilters {
  type?: OrganizationType | OrganizationType[]
  status?: OrganizationStatus | OrganizationStatus[]
  parent_org_id?: string
  search?: string
}

// Status display config
export const ORGANIZATION_STATUS_CONFIG: Record<OrganizationStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Active', color: 'text-green-600', bgColor: 'bg-green-100' },
  inactive: { label: 'Inactive', color: 'text-slate-500', bgColor: 'bg-slate-100' },
  suspended: { label: 'Suspended', color: 'text-red-600', bgColor: 'bg-red-100' },
}

export const ORGANIZATION_TYPE_CONFIG: Record<OrganizationType, { label: string; color: string; bgColor: string }> = {
  kre8ivtech: { label: 'Kre8ivTech', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  partner: { label: 'Partner', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  client: { label: 'Client', color: 'text-slate-600', bgColor: 'bg-slate-100' },
}
