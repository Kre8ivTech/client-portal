/**
 * Ticket Analysis Service
 * 
 * Analyzes incoming tickets for:
 * - Category classification
 * - Priority assessment
 * - Sentiment analysis
 * - Key issue extraction
 * - KB article suggestions
 * - Escalation detection
 */

import { aiClient } from './client'
import { SYSTEM_PROMPTS, TICKET_CATEGORIES, ESCALATION_TRIGGERS, AI_MODELS } from './config'
import type { TicketAnalysis, TicketAnalysisPrompt, AIServiceResponse } from '@/types/ai'
import type { TicketPriority } from '@/types/tickets'

/**
 * Analyze a ticket and return classification + insights
 */
export async function analyzeTicket(
  input: TicketAnalysisPrompt
): Promise<AIServiceResponse<TicketAnalysis>> {
  const userPrompt = buildTicketAnalysisPrompt(input)
  
  const response = await aiClient.analyzeJSON<TicketAnalysis>(
    SYSTEM_PROMPTS.ticketAnalysis,
    userPrompt,
    AI_MODELS.balanced
  )

  if (response.success && response.data) {
    // Post-process and validate the response
    response.data = postProcessAnalysis(response.data, input)
  }

  return response
}

/**
 * Quick classification only (faster, cheaper)
 */
export async function classifyTicket(
  subject: string,
  description: string
): Promise<{ category: string; priority: TicketPriority; confidence: number }> {
  // First try rule-based classification for speed
  const ruleBasedResult = ruleBasedClassification(subject, description)
  
  if (ruleBasedResult.confidence > 0.8) {
    return ruleBasedResult
  }

  // Fall back to AI for uncertain cases
  const response = await aiClient.analyzeJSON<{
    category: string
    priority: TicketPriority
    confidence: number
  }>(
    'You are a ticket classifier. Return JSON with category, priority, and confidence.',
    `Classify this ticket:
Subject: ${subject}
Description: ${description}

Categories: ${Object.keys(TICKET_CATEGORIES).join(', ')}
Priorities: low, medium, high, critical`,
    AI_MODELS.fast
  )

  if (response.success && response.data) {
    return response.data
  }

  return ruleBasedResult // Fall back to rule-based
}

/**
 * Check if ticket needs escalation
 */
export function checkEscalation(subject: string, description: string): {
  requires_escalation: boolean
  reason?: string
} {
  const text = `${subject} ${description}`.toLowerCase()
  
  for (const trigger of ESCALATION_TRIGGERS) {
    if (text.includes(trigger)) {
      return {
        requires_escalation: true,
        reason: `Contains escalation trigger: "${trigger}"`,
      }
    }
  }

  return { requires_escalation: false }
}

/**
 * Generate a suggested response for a ticket
 */
export async function generateSuggestedResponse(
  ticket: {
    subject: string
    description: string
    category: string
    priority: TicketPriority
  },
  tone: 'formal' | 'friendly' | 'concise' = 'friendly'
): Promise<AIServiceResponse<string>> {
  const toneInstructions = {
    formal: 'Use professional, formal language.',
    friendly: 'Be warm and approachable while remaining professional.',
    concise: 'Keep the response brief and to the point.',
  }

  const prompt = `Generate a response to this support ticket.

Subject: ${ticket.subject}
Category: ${ticket.category}
Priority: ${ticket.priority}

Customer message:
${ticket.description}

${toneInstructions[tone]}

Do not make specific timeline promises.
Acknowledge their issue and explain next steps.`

  return aiClient.generateText(
    SYSTEM_PROMPTS.responseGeneration,
    prompt,
    { ...AI_MODELS.balanced, temperature: 0.7 }
  )
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build the prompt for ticket analysis
 */
function buildTicketAnalysisPrompt(input: TicketAnalysisPrompt): string {
  let prompt = `Analyze this support ticket:

Subject: ${input.subject}

Description:
${input.description}

Available categories: ${input.available_categories.join(', ')}`

  if (input.customer_history) {
    prompt += `

Customer history:
- Previous tickets: ${input.customer_history.previous_tickets}
- Average priority: ${input.customer_history.avg_priority}
- Sentiment trend: ${input.customer_history.sentiment_trend}`
  }

  if (input.kb_article_titles?.length) {
    prompt += `

Available KB articles for suggestion:
${input.kb_article_titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
  }

  prompt += `

Return JSON with this structure:
{
  "suggested_category": "string",
  "suggested_priority": "low|medium|high|critical",
  "category_confidence": 0.0-1.0,
  "priority_confidence": 0.0-1.0,
  "sentiment": "positive|neutral|concerned|frustrated|angry",
  "sentiment_score": -1.0 to 1.0,
  "urgency_indicators": ["string"],
  "key_issues": ["string"],
  "affected_systems": ["string"],
  "requested_actions": ["string"],
  "suggested_kb_articles": [{"id": "string", "title": "string", "relevance_score": 0.0-1.0}],
  "requires_escalation": boolean,
  "escalation_reason": "string or null"
}`

  return prompt
}

/**
 * Rule-based classification for common patterns
 */
function ruleBasedClassification(
  subject: string,
  description: string
): { category: string; priority: TicketPriority; confidence: number } {
  const text = `${subject} ${description}`.toLowerCase()
  
  let bestMatch = {
    category: 'general-inquiry',
    priority: 'medium' as TicketPriority,
    confidence: 0.5,
  }

  // Check each category's keywords
  for (const [category, config] of Object.entries(TICKET_CATEGORIES)) {
    const matchCount = config.keywords.filter(kw => text.includes(kw)).length
    const confidence = matchCount / config.keywords.length

    if (confidence > bestMatch.confidence) {
      bestMatch = {
        category,
        priority: config.default_priority,
        confidence: Math.min(confidence * 1.5, 0.95), // Scale up but cap
      }
    }
  }

  // Boost priority for urgent indicators
  if (ESCALATION_TRIGGERS.some(trigger => text.includes(trigger))) {
    bestMatch.priority = 'critical'
  }

  return bestMatch
}

/**
 * Post-process AI analysis to ensure data quality
 */
function postProcessAnalysis(
  analysis: TicketAnalysis,
  input: TicketAnalysisPrompt
): TicketAnalysis {
  // Ensure category is valid
  if (!input.available_categories.includes(analysis.suggested_category)) {
    // Find closest match or default
    const matchingCat = input.available_categories.find(cat =>
      analysis.suggested_category.toLowerCase().includes(cat.toLowerCase())
    )
    analysis.suggested_category = matchingCat || input.available_categories[0] || 'general-inquiry'
  }

  // Ensure priority is valid
  const validPriorities: TicketPriority[] = ['low', 'medium', 'high', 'critical']
  if (!validPriorities.includes(analysis.suggested_priority)) {
    analysis.suggested_priority = 'medium'
  }

  // Add timestamp if missing
  if (!analysis.analysis_timestamp) {
    analysis.analysis_timestamp = new Date().toISOString()
  }

  // Check for escalation if AI missed it
  if (!analysis.requires_escalation) {
    const escalationCheck = checkEscalation(input.subject, input.description)
    if (escalationCheck.requires_escalation) {
      analysis.requires_escalation = true
      analysis.escalation_reason = escalationCheck.reason
    }
  }

  // Ensure arrays exist
  analysis.key_issues = analysis.key_issues || []
  analysis.affected_systems = analysis.affected_systems || []
  analysis.requested_actions = analysis.requested_actions || []
  analysis.suggested_kb_articles = analysis.suggested_kb_articles || []
  analysis.urgency_indicators = analysis.urgency_indicators || []

  return analysis
}
