/**
 * AI Service Configuration
 */

import type { AIServiceConfig } from '@/types/ai'

// Default configuration - can be overridden per-request
export const DEFAULT_AI_CONFIG: AIServiceConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 1024,
  temperature: 0.3, // Lower for more consistent analysis
  cacheResults: true,
  cacheTTLSeconds: 3600, // 1 hour cache
}

// Model options for different use cases
export const AI_MODELS = {
  // Fast, cheap - good for simple classification
  fast: {
    provider: 'anthropic' as const,
    model: 'claude-3-haiku-20240307',
    maxTokens: 512,
    temperature: 0.2,
  },
  // Balanced - good for most analysis
  balanced: {
    provider: 'anthropic' as const,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
    temperature: 0.3,
  },
  // Powerful - for complex reasoning
  powerful: {
    provider: 'anthropic' as const,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    temperature: 0.4,
  },
} as const

// System prompts
export const SYSTEM_PROMPTS = {
  ticketAnalysis: `You are an AI assistant for a web development agency's support ticket system. 
Your job is to analyze incoming support tickets and provide:
1. Category classification
2. Priority assessment
3. Sentiment analysis
4. Key issue extraction
5. Suggested knowledge base articles (if titles provided)
6. Whether escalation is needed

Always respond with valid JSON matching the expected schema.
Be conservative with priority - only mark as critical if truly urgent (system down, security issue, revenue impact).
Consider the customer's tone and history when assessing sentiment.`,

  estimationAnalysis: `You are an AI assistant helping estimate ticket completion times.
Consider:
1. Ticket complexity based on description
2. Historical data from similar tickets
3. Staff availability and current workload
4. Queue position and priority

Provide realistic estimates with appropriate confidence levels.
Factor in buffer time for unexpected complications.
Be transparent about uncertainty - lower confidence for novel issues.

Always respond with valid JSON matching the expected schema.`,

  responseGeneration: `You are a helpful support agent for a web development agency.
Write professional, friendly responses that:
1. Acknowledge the customer's issue
2. Provide clear next steps or solutions
3. Set appropriate expectations
4. Offer additional help if needed

Keep responses concise but thorough. Match the customer's tone.
Never make promises about timelines unless explicitly told to.`,
}

// Category definitions for consistent classification
export const TICKET_CATEGORIES = {
  'technical-support': {
    description: 'Technical issues, bugs, errors, troubleshooting',
    keywords: ['error', 'bug', 'broken', 'not working', 'crash', 'slow', 'issue'],
    default_priority: 'medium' as const,
    typical_hours: 2,
  },
  'billing': {
    description: 'Invoice, payment, pricing, subscription questions',
    keywords: ['invoice', 'payment', 'charge', 'bill', 'price', 'cost', 'refund'],
    default_priority: 'medium' as const,
    typical_hours: 1,
  },
  'general-inquiry': {
    description: 'General questions, information requests',
    keywords: ['question', 'how do', 'can you', 'wondering', 'information'],
    default_priority: 'low' as const,
    typical_hours: 0.5,
  },
  'bug-report': {
    description: 'Software bugs requiring investigation and fix',
    keywords: ['bug', 'defect', 'regression', 'broken feature', 'unexpected behavior'],
    default_priority: 'high' as const,
    typical_hours: 4,
  },
  'feature-request': {
    description: 'New feature suggestions or enhancements',
    keywords: ['feature', 'enhancement', 'would be nice', 'suggestion', 'could you add'],
    default_priority: 'low' as const,
    typical_hours: 0.5, // Just for intake, not implementation
  },
  'urgent': {
    description: 'Critical issues requiring immediate attention',
    keywords: ['urgent', 'emergency', 'down', 'critical', 'asap', 'immediately'],
    default_priority: 'critical' as const,
    typical_hours: 1,
  },
}

// Priority escalation triggers
export const ESCALATION_TRIGGERS = [
  'security',
  'data breach',
  'legal',
  'lawsuit',
  'compliance',
  'gdpr',
  'down',
  'outage',
  'all users affected',
  'revenue loss',
  'cannot process payments',
]

// Complexity indicators for estimation
export const COMPLEXITY_INDICATORS = {
  high: [
    'multiple systems',
    'integration',
    'database migration',
    'security',
    'performance optimization',
    'architecture change',
    'third-party api',
  ],
  medium: [
    'investigation needed',
    'debugging',
    'configuration change',
    'update',
    'modification',
  ],
  low: [
    'simple fix',
    'typo',
    'text change',
    'quick question',
    'how to',
  ],
}
