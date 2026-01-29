/**
 * AI Client - Handles communication with AI providers
 * 
 * Note: This requires the @anthropic-ai/sdk package to be installed.
 * Run: npm install @anthropic-ai/sdk
 */

import { DEFAULT_AI_CONFIG } from './config'
import type { AIServiceConfig, AIServiceResponse } from '@/types/ai'

// Types for the Anthropic SDK response
interface AnthropicMessage {
  content: Array<{
    type: 'text'
    text: string
  }>
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

/**
 * AI Client class for making requests to AI providers
 */
export class AIClient {
  private config: AIServiceConfig

  constructor(config: Partial<AIServiceConfig> = {}) {
    this.config = { ...DEFAULT_AI_CONFIG, ...config }
  }

  /**
   * Send a message to the AI and get a JSON response
   */
  async analyzeJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    options: Partial<AIServiceConfig> = {}
  ): Promise<AIServiceResponse<T>> {
    const startTime = Date.now()
    const config = { ...this.config, ...options }

    try {
      // Dynamic import to handle missing SDK gracefully
      const Anthropic = await this.getAnthropicSDK()
      
      if (!Anthropic) {
        return this.getMockResponse<T>(userPrompt)
      }

      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })

      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `${userPrompt}\n\nRespond with valid JSON only, no markdown or explanation.`,
          },
        ],
      }) as AnthropicMessage

      const latency = Date.now() - startTime
      const text = response.content[0]?.text || '{}'
      const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)

      // Parse JSON response
      const data = this.parseJSON<T>(text)

      return {
        success: true,
        data,
        cached: false,
        tokens_used: tokensUsed,
        latency_ms: latency,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      console.error('AI analysis error:', error)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cached: false,
        tokens_used: 0,
        latency_ms: latency,
      }
    }
  }

  /**
   * Generate text response (for suggested replies, etc.)
   */
  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options: Partial<AIServiceConfig> = {}
  ): Promise<AIServiceResponse<string>> {
    const startTime = Date.now()
    const config = { ...this.config, ...options }

    try {
      const Anthropic = await this.getAnthropicSDK()
      
      if (!Anthropic) {
        return {
          success: true,
          data: 'AI response generation is not available in development mode.',
          cached: false,
          tokens_used: 0,
          latency_ms: Date.now() - startTime,
        }
      }

      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })

      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature || 0.7, // Higher for more creative responses
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      }) as AnthropicMessage

      const latency = Date.now() - startTime
      const text = response.content[0]?.text || ''
      const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)

      return {
        success: true,
        data: text,
        cached: false,
        tokens_used: tokensUsed,
        latency_ms: latency,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      console.error('AI generation error:', error)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cached: false,
        tokens_used: 0,
        latency_ms: latency,
      }
    }
  }

  /**
   * Dynamically import Anthropic SDK
   */
  private async getAnthropicSDK(): Promise<any | null> {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      return Anthropic
    } catch {
      console.warn('Anthropic SDK not installed. Using mock responses.')
      return null
    }
  }

  /**
   * Parse JSON from AI response, handling common issues
   */
  private parseJSON<T>(text: string): T {
    // Remove markdown code blocks if present
    let cleaned = text.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7)
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3)
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3)
    }
    cleaned = cleaned.trim()

    return JSON.parse(cleaned) as T
  }

  /**
   * Generate mock response for development without API key
   */
  private getMockResponse<T>(prompt: string): AIServiceResponse<T> {
    console.warn('Using mock AI response - set ANTHROPIC_API_KEY for real analysis')
    
    // Return a reasonable mock based on the type expected
    const mockData = {
      suggested_category: 'technical-support',
      suggested_priority: 'medium',
      category_confidence: 0.75,
      priority_confidence: 0.7,
      sentiment: 'neutral',
      sentiment_score: 0,
      urgency_indicators: [],
      key_issues: ['Issue requires investigation'],
      affected_systems: [],
      requested_actions: ['Please investigate and respond'],
      suggested_kb_articles: [],
      requires_escalation: false,
      analysis_timestamp: new Date().toISOString(),
      model_used: 'mock',
      tokens_used: 0,
    } as unknown as T

    return {
      success: true,
      data: mockData,
      cached: false,
      tokens_used: 0,
      latency_ms: 10,
    }
  }
}

// Singleton instance for convenience
export const aiClient = new AIClient()
