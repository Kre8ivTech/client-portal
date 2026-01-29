/**
 * AI Services for KT-Portal
 * 
 * Provides:
 * - Ticket classification and analysis
 * - Sentiment detection
 * - Workload analysis
 * - Completion time estimation
 * - Response suggestions
 */

// Client
export { AIClient, aiClient } from './client'

// Ticket Analysis
export {
  analyzeTicket,
  classifyTicket,
  checkEscalation,
  generateSuggestedResponse,
} from './ticket-analyzer'

// Workload & Estimation
export {
  analyzeWorkload,
  estimateCompletion,
  generateAvailabilityWindows,
} from './workload-estimator'

// Configuration
export {
  DEFAULT_AI_CONFIG,
  AI_MODELS,
  SYSTEM_PROMPTS,
  TICKET_CATEGORIES,
  ESCALATION_TRIGGERS,
  COMPLEXITY_INDICATORS,
} from './config'
