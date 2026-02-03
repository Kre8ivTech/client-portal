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

// =============================================================================
// TASK STATUSES AND TYPES
// =============================================================================

export const TASK_STATUSES = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'completed',
  'cancelled',
] as const

export const TASK_STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

export const TASK_TYPES = [
  'task',
  'bug',
  'feature',
  'improvement',
  'documentation',
  'research',
] as const

export const TASK_TYPE_OPTIONS = [
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'research', label: 'Research' },
] as const

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export const TASK_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const

// Kanban board columns (subset of statuses for board view)
export const KANBAN_COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: 'bg-slate-100' },
  { id: 'todo', label: 'To Do', color: 'bg-blue-100' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-yellow-100' },
  { id: 'in_review', label: 'In Review', color: 'bg-purple-100' },
  { id: 'completed', label: 'Done', color: 'bg-green-100' },
] as const

// Schema definitions for tasks
export const taskStatusSchema = z.enum(TASK_STATUSES)
export const taskTypeSchema = z.enum(TASK_TYPES)
export const taskPrioritySchema = z.enum(TASK_PRIORITIES)

// Create task schema
export const createTaskSchema = z.object({
  title: z.string().min(1, { message: 'Task title is required.' }).max(500),
  description: z.string().optional().nullable(),
  status: taskStatusSchema.default('backlog'),
  priority: taskPrioritySchema.default('medium'),
  task_type: taskTypeSchema.default('task'),
  milestone_id: z.string().uuid().optional().nullable(),
  parent_task_id: z.string().uuid().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  estimated_hours: z.number().min(0).optional().nullable(),
  billable: z.boolean().default(true),
  hourly_rate: z.number().int().min(0).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>

// Update task schema
export const updateTaskSchema = z.object({
  title: z.string().min(1, { message: 'Task title is required.' }).max(500).optional(),
  description: z.string().optional().nullable(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  task_type: taskTypeSchema.optional(),
  milestone_id: z.string().uuid().optional().nullable(),
  parent_task_id: z.string().uuid().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  estimated_hours: z.number().min(0).optional().nullable(),
  billable: z.boolean().optional(),
  hourly_rate: z.number().int().min(0).optional().nullable(),
  tags: z.array(z.string()).optional(),
  sort_order: z.number().int().optional(),
  board_column_order: z.number().int().optional(),
})

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>

// Move task schema (for drag and drop)
export const moveTaskSchema = z.object({
  status: taskStatusSchema,
  board_column_order: z.number().int(),
})

export type MoveTaskInput = z.infer<typeof moveTaskSchema>

// =============================================================================
// MILESTONE SCHEMAS
// =============================================================================

export const MILESTONE_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'missed',
] as const

export const MILESTONE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'missed', label: 'Missed' },
] as const

export const milestoneStatusSchema = z.enum(MILESTONE_STATUSES)

// Create milestone schema
export const createMilestoneSchema = z.object({
  name: z.string().min(1, { message: 'Milestone name is required.' }).max(255),
  description: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  status: milestoneStatusSchema.default('pending'),
  sort_order: z.number().int().optional(),
})

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>

// Update milestone schema
export const updateMilestoneSchema = z.object({
  name: z.string().min(1, { message: 'Milestone name is required.' }).max(255).optional(),
  description: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  completed_date: z.string().optional().nullable(),
  status: milestoneStatusSchema.optional(),
  sort_order: z.number().int().optional(),
})

export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>

// =============================================================================
// TIME ENTRY SCHEMAS
// =============================================================================

// Create time entry schema
export const createTimeEntrySchema = z.object({
  task_id: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  hours: z.number().min(0.01).max(24),
  entry_date: z.string(),
  billable: z.boolean().default(true),
  hourly_rate: z.number().int().min(0).optional().nullable(),
})

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>

// Update time entry schema
export const updateTimeEntrySchema = z.object({
  task_id: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  hours: z.number().min(0.01).max(24).optional(),
  entry_date: z.string().optional(),
  billable: z.boolean().optional(),
  hourly_rate: z.number().int().min(0).optional().nullable(),
})

export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>

// =============================================================================
// TASK COMMENT SCHEMAS
// =============================================================================

export const createTaskCommentSchema = z.object({
  content: z.string().min(1, { message: 'Comment content is required.' }),
})

export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>

export const updateTaskCommentSchema = z.object({
  content: z.string().min(1, { message: 'Comment content is required.' }),
})

export type UpdateTaskCommentInput = z.infer<typeof updateTaskCommentSchema>
