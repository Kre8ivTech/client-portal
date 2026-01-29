/**
 * Ticket Types for KT-Portal
 */

// Priority levels
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'

// Status workflow
export type TicketStatus = 
  | 'new' 
  | 'open' 
  | 'in_progress' 
  | 'pending_client' 
  | 'resolved' 
  | 'closed'

// Attachment stored in JSONB
export interface TicketAttachment {
  id: string
  filename: string
  url: string
  size: number
  type: string
}

// Database row type
export interface Ticket {
  id: string
  organization_id: string
  ticket_number: string
  subject: string
  description: string
  priority: TicketPriority
  status: TicketStatus
  category: string | null
  tags: string[]
  created_by: string
  assigned_to: string | null
  parent_ticket_id: string | null
  client_org_id: string | null
  sla_due_at: string | null
  first_response_at: string | null
  resolved_at: string | null
  queue_position: number | null
  queue_calculated_at: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

// Ticket with expanded relations
export interface TicketWithRelations extends Ticket {
  created_by_profile?: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
  assigned_to_profile?: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
  organization?: {
    id: string
    name: string
    slug: string
  }
  comments_count?: number
}

// Ticket comment
export interface TicketComment {
  id: string
  ticket_id: string
  user_id: string
  content: string
  is_internal: boolean
  attachments: TicketAttachment[]
  created_at: string
  updated_at: string
}

// Comment with user info
export interface TicketCommentWithUser extends TicketComment {
  user?: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
    role: string
  }
}

// Ticket category
export interface TicketCategory {
  id: string
  organization_id: string | null
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  default_priority: TicketPriority
  sla_response_hours: number | null
  sla_resolution_hours: number | null
  sort_order: number
  is_active: boolean
  created_at: string
}

// Input types for forms
export interface CreateTicketInput {
  subject: string
  description: string
  priority?: TicketPriority
  category?: string
  tags?: string[]
  client_org_id?: string // For partners creating on behalf of clients
}

export interface UpdateTicketInput {
  subject?: string
  description?: string
  priority?: TicketPriority
  status?: TicketStatus
  category?: string
  tags?: string[]
  assigned_to?: string | null
}

export interface CreateCommentInput {
  ticket_id: string
  content: string
  is_internal?: boolean
  attachments?: TicketAttachment[]
}

// Filter options for ticket list
export interface TicketFilters {
  status?: TicketStatus | TicketStatus[]
  priority?: TicketPriority | TicketPriority[]
  category?: string
  assigned_to?: string
  created_by?: string
  search?: string
  date_from?: string
  date_to?: string
}

// Sort options
export type TicketSortField = 'created_at' | 'updated_at' | 'priority' | 'status' | 'queue_position'
export type SortDirection = 'asc' | 'desc'

export interface TicketSort {
  field: TicketSortField
  direction: SortDirection
}

// Priority and status display helpers
export const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Low', color: 'text-slate-600', bgColor: 'bg-slate-100' },
  medium: { label: 'Medium', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  critical: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100' },
}

export const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; bgColor: string }> = {
  new: { label: 'New', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  open: { label: 'Open', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  pending_client: { label: 'Pending Client', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  resolved: { label: 'Resolved', color: 'text-green-600', bgColor: 'bg-green-100' },
  closed: { label: 'Closed', color: 'text-slate-500', bgColor: 'bg-slate-100' },
}
