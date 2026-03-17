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
