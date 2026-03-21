import { getSupabaseAdmin } from '@/lib/supabase/admin'

// Model pricing in USD per 1M tokens (input/output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenRouter models
  'anthropic/claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'anthropic/claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  'anthropic/claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'openai/gpt-4o': { input: 2.5, output: 10.0 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  // Direct provider models
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
}

interface UsageLogEntry {
  userId: string
  organizationId?: string
  conversationId?: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  requestType: 'chat' | 'contract_generate' | 'other'
  status: 'success' | 'error' | 'rate_limited'
  errorMessage?: string
  latencyMs?: number
}

/**
 * Calculate estimated cost in USD cents based on model and token usage
 */
export function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) return 0

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output

  // Convert to cents and round up
  return Math.ceil((inputCost + outputCost) * 100)
}

/**
 * Log an AI usage entry to the database
 */
export async function logAIUsage(entry: UsageLogEntry): Promise<void> {
  try {
    const costCents = calculateCostCents(entry.model, entry.inputTokens, entry.outputTokens)

    const supabaseAdmin = getSupabaseAdmin()
    await (supabaseAdmin as any).from('ai_usage_logs').insert({
      user_id: entry.userId,
      organization_id: entry.organizationId || null,
      conversation_id: entry.conversationId || null,
      provider: entry.provider,
      model: entry.model,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      estimated_cost_cents: costCents,
      request_type: entry.requestType,
      status: entry.status,
      error_message: entry.errorMessage || null,
      latency_ms: entry.latencyMs || null,
    })
  } catch (error) {
    console.error('[AI Usage] Failed to log usage:', error)
  }
}

/** Rough token estimate (~4 chars per token for English). */
export function roughTokenEstimate(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

/**
 * Sum input+output tokens for successful chat requests today (UTC day) for a user.
 */
export async function getDailyChatTokenTotal(userId: string): Promise<number> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const start = new Date()
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)

    const { data, error } = await (supabaseAdmin as any)
      .from('ai_usage_logs')
      .select('input_tokens, output_tokens')
      .eq('user_id', userId)
      .eq('request_type', 'chat')
      .eq('status', 'success')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())

    if (error || !data?.length) return 0

    return data.reduce(
      (sum: number, row: { input_tokens: number; output_tokens: number }) =>
        sum + (row.input_tokens || 0) + (row.output_tokens || 0),
      0
    )
  } catch {
    return 0
  }
}

export type ChatbotTokenCheck = {
  allowed: boolean
  usedToday: number
  limit: number | null
  estimatedThisRequest: number
}

/**
 * Daily token budget for the portal chatbot (guides users; not a general-purpose AI).
 * super_admin, staff, and admin: unlimited (null).
 * Others: AI_CHATBOT_DAILY_TOKEN_LIMIT (default 60000).
 */
export async function checkChatbotTokenBudget(params: {
  userId: string
  role: string
  systemPrompt: string
  messages: { role: string; content: string }[]
}): Promise<ChatbotTokenCheck> {
  const unlimitedRoles = new Set(['super_admin', 'staff', 'admin'])
  if (unlimitedRoles.has(params.role)) {
    return {
      allowed: true,
      usedToday: 0,
      limit: null,
      estimatedThisRequest: 0,
    }
  }

  const rawLimit = process.env.AI_CHATBOT_DAILY_TOKEN_LIMIT
  const limit =
    rawLimit === undefined || rawLimit === ''
      ? 60_000
      : Math.max(1000, parseInt(rawLimit, 10) || 60_000)

  const usedToday = await getDailyChatTokenTotal(params.userId)

  const historyText = params.messages.map((m) => m.content).join('\n')
  // Cap per-request estimate so one huge KB blob does not block only on paper forever
  const estimatedThisRequest = Math.min(roughTokenEstimate(params.systemPrompt + historyText), 80_000) + 2_000

  const allowed = usedToday + estimatedThisRequest <= limit

  return {
    allowed,
    usedToday,
    limit,
    estimatedThisRequest,
  }
}

/**
 * Check if a user has exceeded their daily rate limit.
 * Returns { allowed: boolean, remaining: number, limit: number }
 */
export async function checkAIRateLimit(
  userId: string,
  dailyLimit: number = 100
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const today = new Date().toISOString().split('T')[0]

    const { count } = await (supabaseAdmin as any)
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`)

    const used = count || 0
    const remaining = Math.max(0, dailyLimit - used)

    return {
      allowed: used < dailyLimit,
      remaining,
      limit: dailyLimit,
    }
  } catch {
    // On error, allow the request (fail open for rate limiting)
    return { allowed: true, remaining: 0, limit: dailyLimit }
  }
}

/**
 * Extract token usage from various provider response formats
 */
export function extractTokenUsage(
  provider: string,
  responseData: any
): { inputTokens: number; outputTokens: number } {
  try {
    switch (provider) {
      case 'openrouter':
      case 'openai':
        return {
          inputTokens: responseData?.usage?.prompt_tokens || 0,
          outputTokens: responseData?.usage?.completion_tokens || 0,
        }
      case 'anthropic':
        return {
          inputTokens: responseData?.usage?.input_tokens || 0,
          outputTokens: responseData?.usage?.output_tokens || 0,
        }
      default:
        return { inputTokens: 0, outputTokens: 0 }
    }
  } catch {
    return { inputTokens: 0, outputTokens: 0 }
  }
}
