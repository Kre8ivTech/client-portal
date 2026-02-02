import { z } from 'zod'

// Project statuses
export const PROJECT_STATUSES = [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
  'archived',
] as const

export const PROJECT_STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
] as const

// Project priorities
export const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export const PROJECT_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const

// Project member roles
export const PROJECT_MEMBER_ROLES = [
  'project_manager',
  'account_manager',
  'team_member',
  'observer',
] as const

export const PROJECT_MEMBER_ROLE_OPTIONS = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'account_manager', label: 'Account Manager' },
  { value: 'team_member', label: 'Team Member' },
  { value: 'observer', label: 'Observer' },
] as const

// Project organization roles
export const PROJECT_ORG_ROLES = [
  'client',
  'partner',
  'vendor',
  'collaborator',
] as const

export const PROJECT_ORG_ROLE_OPTIONS = [
  { value: 'client', label: 'Client' },
  { value: 'partner', label: 'Partner' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'collaborator', label: 'Collaborator' },
] as const

// Schema definitions
export const projectStatusSchema = z.enum(PROJECT_STATUSES)
export const projectPrioritySchema = z.enum(PROJECT_PRIORITIES)
export const projectMemberRoleSchema = z.enum(PROJECT_MEMBER_ROLES)
export const projectOrgRoleSchema = z.enum(PROJECT_ORG_ROLES)

// Create project schema
export const createProjectSchema = z.object({
  name: z.string().min(3, { message: 'Project name must be at least 3 characters.' }).max(255),
  description: z.string().optional(),
  status: projectStatusSchema.default('planning'),
  priority: projectPrioritySchema.default('medium'),
  start_date: z.string().optional().nullable(),
  target_end_date: z.string().optional().nullable(),
  budget_amount: z.number().int().min(0).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>

// Update project schema
export const updateProjectSchema = z.object({
  name: z.string().min(3, { message: 'Project name must be at least 3 characters.' }).max(255).optional(),
  description: z.string().optional().nullable(),
  status: projectStatusSchema.optional(),
  priority: projectPrioritySchema.optional(),
  start_date: z.string().optional().nullable(),
  target_end_date: z.string().optional().nullable(),
  actual_end_date: z.string().optional().nullable(),
  budget_amount: z.number().int().min(0).optional().nullable(),
  tags: z.array(z.string()).optional(),
})

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

// Add project member schema
export const addProjectMemberSchema = z.object({
  user_id: z.string().uuid({ message: 'Invalid user ID.' }),
  role: projectMemberRoleSchema.default('team_member'),
})

export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>

// Update project member schema
export const updateProjectMemberSchema = z.object({
  role: projectMemberRoleSchema.optional(),
  is_active: z.boolean().optional(),
})

export type UpdateProjectMemberInput = z.infer<typeof updateProjectMemberSchema>

// Add project organization schema
export const addProjectOrganizationSchema = z.object({
  organization_id: z.string().uuid({ message: 'Invalid organization ID.' }),
  role: projectOrgRoleSchema.default('client'),
})

export type AddProjectOrganizationInput = z.infer<typeof addProjectOrganizationSchema>

// Update project organization schema
export const updateProjectOrganizationSchema = z.object({
  role: projectOrgRoleSchema.optional(),
  is_active: z.boolean().optional(),
})

export type UpdateProjectOrganizationInput = z.infer<typeof updateProjectOrganizationSchema>
