/**
 * AI Service Types for KT-Portal
 */

import type { TicketPriority, TicketStatus } from './tickets'

// =============================================================================
// TICKET ANALYSIS
// =============================================================================

export interface TicketAnalysis {
  // Classification
  suggested_category: string
  suggested_priority: TicketPriority
  category_confidence: number
  priority_confidence: number
  
  // Sentiment
  sentiment: 'positive' | 'neutral' | 'concerned' | 'frustrated' | 'angry'
  sentiment_score: number // -1 to 1
  urgency_indicators: string[]
  
  // Content extraction
  key_issues: string[]
  affected_systems: string[]
  requested_actions: string[]
  
  // Suggestions
  suggested_kb_articles: SuggestedArticle[]
  suggested_response?: string
  
  // Routing
  suggested_assignee?: string
  requires_escalation: boolean
  escalation_reason?: string
  
  // Metadata
  analysis_timestamp: string
  model_used: string
  tokens_used: number
}

export interface SuggestedArticle {
  id: string
  title: string
  relevance_score: number
  excerpt?: string
}

// =============================================================================
// WORKLOAD & ESTIMATION
// =============================================================================

export interface WorkloadAnalysis {
  staff_id: string
  analysis_date: string
  
  // Current state
  current_tickets: number
  current_tasks: number
  estimated_hours_queued: number
  
  // Capacity
  available_hours_today: number
  available_hours_week: number
  utilization_percent: number
  
  // Breakdown by priority
  hours_by_priority: {
    critical: number
    high: number
    medium: number
    low: number
  }
  
  // Predictions
  can_take_new_work: boolean
  next_available_slot: string // ISO date
  recommended_capacity: number // 0-100%
}

export interface CompletionEstimate {
  ticket_id?: string
  task_id?: string
  project_id?: string
  
  // The estimate
  estimated_start_date: string
  estimated_completion_date: string
  confidence_level: 'low' | 'medium' | 'high'
  confidence_percent: number
  
  // Work breakdown
  estimated_hours: number
  complexity_score: number // 0-1
  
  // Factors considered
  factors: EstimationFactor[]
  
  // Staff assignment
  assigned_to?: string
  staff_availability: StaffAvailabilityWindow[]
  
  // Queue context
  queue_position: number
  tickets_ahead: number
  
  // Client message
  client_message: string
  detailed_breakdown?: string
}

export interface EstimationFactor {
  factor: string
  impact: 'increases' | 'decreases' | 'neutral'
  description: string
  weight: number
}

export interface StaffAvailabilityWindow {
  date: string
  available_hours: number
  blocked_hours: number
  net_hours: number
}

// =============================================================================
// HISTORICAL ANALYSIS (For improving estimates)
// =============================================================================

export interface HistoricalTicketData {
  category: string
  priority: TicketPriority
  complexity_indicators: string[]
  actual_hours: number
  estimated_hours: number
  accuracy_percent: number
}

export interface EstimationAccuracy {
  period: string
  total_estimates: number
  accurate_count: number // Within 20%
  accuracy_rate: number
  avg_variance_hours: number
  by_category: Record<string, {
    count: number
    accuracy_rate: number
    avg_variance: number
  }>
}

// =============================================================================
// AI SERVICE INTERFACES
// =============================================================================

export interface AIServiceConfig {
  provider: 'anthropic' | 'openai'
  model: string
  maxTokens: number
  temperature: number
  cacheResults: boolean
  cacheTTLSeconds: number
}

export interface AIServiceResponse<T> {
  success: boolean
  data?: T
  error?: string
  cached: boolean
  tokens_used: number
  latency_ms: number
}

// =============================================================================
// PROMPTS & TEMPLATES
// =============================================================================

export interface TicketAnalysisPrompt {
  subject: string
  description: string
  customer_history?: {
    previous_tickets: number
    avg_priority: string
    sentiment_trend: string
  }
  available_categories: string[]
  kb_article_titles?: string[]
}

export interface EstimationPrompt {
  ticket_subject: string
  ticket_description: string
  ticket_category: string
  ticket_priority: TicketPriority
  similar_tickets: HistoricalTicketData[]
  staff_workload: WorkloadAnalysis
  current_queue: {
    position: number
    tickets_ahead_hours: number
  }
}

// =============================================================================
// STAFF CAPACITY TYPES
// =============================================================================

export interface StaffSchedule {
  id: string
  profile_id: string
  day_of_week: number // 0-6
  start_time: string | null
  end_time: string | null
  is_working_day: boolean
  available_hours: number
  timezone: string
}

export interface CalendarBlock {
  id: string
  profile_id: string
  block_type: 'time_off' | 'meeting' | 'focus_time' | 'out_of_office' | 'holiday'
  title: string | null
  description: string | null
  start_at: string
  end_at: string
  all_day: boolean
  is_recurring: boolean
  recurrence_rule: string | null
}

export interface StaffSkill {
  id: string
  profile_id: string
  skill_name: string
  skill_category: string | null
  proficiency_level: number // 1-5
  can_handle_categories: string[]
}

export interface TaskEstimate {
  id: string
  ticket_id: string | null
  task_id: string | null
  estimated_hours: number
  estimated_by: string | null
  estimation_method: 'manual' | 'ai_suggested' | 'historical_average' | 'complexity_based'
  ai_analysis: TicketAnalysis | null
  actual_hours: number | null
  variance_hours: number | null
  was_accurate: boolean | null
  feedback: string | null
}
