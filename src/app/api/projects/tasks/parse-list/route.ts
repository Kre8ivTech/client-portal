import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  parseTaskListFromText,
  parsedTaskCandidateSchema,
} from '@/lib/task-list-parser'

const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

const parseRequestSchema = z.object({
  text: z.string().min(1).max(50000),
  use_ai: z.boolean().optional().default(true),
  max_items: z.number().int().min(1).max(100).optional().default(100),
})

const aiResponseSchema = z.object({
  tasks: z.array(parsedTaskCandidateSchema).min(1).max(100),
})

type SupportedProvider = 'openrouter' | 'anthropic' | 'openai'

type AIProviderConfig = {
  primaryProvider: SupportedProvider
  openRouterKey: string | null
  anthropicKey: string | null
  openAiKey: string | null
}

function stripCodeFence(input: string): string {
  const fenced = input.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return fenced?.[1]?.trim() ?? input.trim()
}

function hasTasksArray(value: unknown): value is { tasks: unknown[] } {
  if (!value || typeof value !== 'object') return false
  if (!('tasks' in value)) return false

  const candidate = value as { tasks?: unknown }
  return Array.isArray(candidate.tasks)
}

function parseAiResponsePayload(rawResponse: string) {
  const candidate = stripCodeFence(rawResponse)
  const firstObjectIdx = candidate.indexOf('{')
  const firstArrayIdx = candidate.indexOf('[')

  const firstJsonIdx =
    firstObjectIdx === -1
      ? firstArrayIdx
      : firstArrayIdx === -1
        ? firstObjectIdx
        : Math.min(firstObjectIdx, firstArrayIdx)

  if (firstJsonIdx === -1) {
    return null
  }

  const startsWithObject = candidate[firstJsonIdx] === '{'
  const lastJsonIdx = startsWithObject
    ? candidate.lastIndexOf('}')
    : candidate.lastIndexOf(']')

  if (lastJsonIdx === -1 || lastJsonIdx <= firstJsonIdx) {
    return null
  }

  const jsonPayload = candidate.slice(firstJsonIdx, lastJsonIdx + 1)

  try {
    const parsed = JSON.parse(jsonPayload) as unknown
    const normalized =
      hasTasksArray(parsed)
        ? parsed
        : Array.isArray(parsed)
          ? { tasks: parsed }
          : null

    if (!normalized) return null

    const validation = aiResponseSchema.safeParse(normalized)
    return validation.success ? validation.data.tasks : null
  } catch {
    return null
  }
}

function getProviderOrder(
  primaryProvider: SupportedProvider
): SupportedProvider[] {
  const providers: SupportedProvider[] = [primaryProvider]

  if (!providers.includes('openrouter')) providers.push('openrouter')
  if (!providers.includes('anthropic')) providers.push('anthropic')
  if (!providers.includes('openai')) providers.push('openai')

  return providers
}

function getSystemPrompt() {
  return [
    'You convert pasted client feedback into project task items.',
    'Return strict JSON only. No markdown, no prose.',
    'JSON shape:',
    '{"tasks":[{"title":"string","description":"string|null","priority":"low|medium|high|critical"}]}',
    'Rules:',
    '- Preserve each distinct requested action as its own task.',
    '- Keep title concise and action-oriented (max 120 chars).',
    '- Keep description clear and concise, preserving important context.',
    '- Priority should reflect urgency and impact.',
    '- Do not invent requirements that are not in the source text.',
  ].join('\n')
}

function getUserPrompt(
  rawText: string,
  heuristicTasks: ReturnType<typeof parseTaskListFromText>,
  maxItems: number
) {
  return [
    `Maximum tasks to return: ${maxItems}`,
    '',
    'Raw pasted list:',
    rawText,
    '',
    'Heuristic baseline tasks (use as segmentation hint, improve wording/priority):',
    JSON.stringify(heuristicTasks, null, 2),
    '',
    'Return JSON only.',
  ].join('\n')
}

async function getAIProviderConfig(): Promise<AIProviderConfig> {
  const openRouterKeyFromEnv = process.env.OPENROUTER_API_KEY ?? null
  const anthropicKeyFromEnv = process.env.ANTHROPIC_API_KEY ?? null
  const openAiKeyFromEnv = process.env.OPENAI_API_KEY ?? null

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return {
      primaryProvider: 'openrouter',
      openRouterKey: openRouterKeyFromEnv,
      anthropicKey: anthropicKeyFromEnv,
      openAiKey: openAiKeyFromEnv,
    }
  }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data } = await supabaseAdmin
      .from('app_settings')
      .select(
        'ai_provider_primary, openrouter_api_key, anthropic_api_key, openai_api_key'
      )
      .eq('id', APP_SETTINGS_ID)
      .maybeSingle()

    return {
      primaryProvider:
        data?.ai_provider_primary === 'anthropic' ||
        data?.ai_provider_primary === 'openai'
          ? data.ai_provider_primary
          : 'openrouter',
      openRouterKey: data?.openrouter_api_key ?? openRouterKeyFromEnv,
      anthropicKey: data?.anthropic_api_key ?? anthropicKeyFromEnv,
      openAiKey: data?.openai_api_key ?? openAiKeyFromEnv,
    }
  } catch {
    return {
      primaryProvider: 'openrouter',
      openRouterKey: openRouterKeyFromEnv,
      anthropicKey: anthropicKeyFromEnv,
      openAiKey: openAiKeyFromEnv,
    }
  }
}

async function tryProvider(
  provider: SupportedProvider,
  config: AIProviderConfig,
  systemPrompt: string,
  userPrompt: string
) {
  if (provider === 'openrouter' && config.openRouterKey) {
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: config.openRouterKey,
    })

    const response = await client.chat.completions.create({
      model: 'anthropic/claude-3.5-sonnet',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      extra_headers: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://client-portal.com',
        'X-Title': 'KT Portal Task List Parser',
      },
    })

    return response.choices[0]?.message?.content ?? null
  }

  if (provider === 'anthropic' && config.anthropicKey) {
    const client = new Anthropic({ apiKey: config.anthropicKey })
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1600,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    return response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n')
  }

  if (provider === 'openai' && config.openAiKey) {
    const client = new OpenAI({ apiKey: config.openAiKey })
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    return response.choices[0]?.message?.content ?? null
  }

  return null
}

async function parseWithAI(
  rawText: string,
  heuristicTasks: ReturnType<typeof parseTaskListFromText>,
  maxItems: number
) {
  const config = await getAIProviderConfig()
  const providers = getProviderOrder(config.primaryProvider)
  const systemPrompt = getSystemPrompt()
  const userPrompt = getUserPrompt(rawText, heuristicTasks, maxItems)

  for (const provider of providers) {
    try {
      const rawResponse = await tryProvider(
        provider,
        config,
        systemPrompt,
        userPrompt
      )

      if (!rawResponse) continue

      const parsed = parseAiResponsePayload(rawResponse)
      if (parsed && parsed.length > 0) {
        return parsed.slice(0, maxItems)
      }
    } catch {
      // Try next provider
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsedBody = parseRequestSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request payload' },
        { status: 400 }
      )
    }

    const { text, use_ai, max_items } = parsedBody.data
    const heuristicTasks = parseTaskListFromText(text, max_items)

    if (heuristicTasks.length === 0) {
      return NextResponse.json(
        { error: 'Could not parse any tasks from the pasted list' },
        { status: 400 }
      )
    }

    if (!use_ai) {
      return NextResponse.json({
        source: 'heuristic',
        tasks: heuristicTasks,
      })
    }

    const aiTasks = await parseWithAI(text, heuristicTasks, max_items)
    if (aiTasks && aiTasks.length > 0) {
      return NextResponse.json({
        source: 'ai',
        tasks: aiTasks,
      })
    }

    return NextResponse.json({
      source: 'heuristic',
      tasks: heuristicTasks,
      warning:
        'AI analysis is currently unavailable, so we used deterministic parsing.',
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse task list' },
      { status: 500 }
    )
  }
}
