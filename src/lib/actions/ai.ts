'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/require-role'

export async function updateAIConfig(role: string, prompt: string, model: string = 'gpt-4o') {
  await requireRole(['super_admin', 'staff'])
  
  const supabase = await createServerSupabaseClient()
  
  // Upsert the config for the role (global config, organization_id null)
  const { error } = await (supabase as any)
    .from('ai_configs')
    .upsert({
      role,
      system_prompt: prompt,
      model,
      organization_id: null // Global for now
    }, { onConflict: 'organization_id, role' })
    
  if (error) {
    console.error('Error updating AI config:', error)
    return { success: false, error: error.message }
  }
  
  revalidatePath('/dashboard/admin/ai-assistant')
  return { success: true }
}

export async function getAIResponse(messages: Array<{ role: string; content: string }>) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Unauthorized' }
  
  // 1. Get User Role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
    
  const userRole = (userData as any)?.role || 'client'
  
  // 2. Fetch System Prompt for this role
  const { data: config } = await (supabase as any)
    .from('ai_configs')
    .select('system_prompt')
    .eq('role', userRole)
    .is('organization_id', null)
    .single()
    
  const systemPrompt = (config as any)?.system_prompt || 'You are a helpful assistant.'

  // 3. Fetch AI provider config from app_settings
  const { data: settings } = await (supabase as any)
    .from('app_settings')
    .select('ai_provider_primary, openrouter_api_key, anthropic_api_key, openai_api_key')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()

  if (!settings) {
    return {
      role: 'assistant',
      content: 'AI assistant is not configured. Please contact your administrator.',
    }
  }

  const provider = settings.ai_provider_primary || 'openrouter'
  let apiKey: string | null = null
  let apiUrl = ''
  let model = ''

  switch (provider) {
    case 'openrouter':
      apiKey = settings.openrouter_api_key
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions'
      model = 'anthropic/claude-3.5-sonnet'
      break
    case 'anthropic':
      apiKey = settings.anthropic_api_key
      apiUrl = 'https://api.anthropic.com/v1/messages'
      model = 'claude-3-5-sonnet-20241022'
      break
    case 'openai':
      apiKey = settings.openai_api_key
      apiUrl = 'https://api.openai.com/v1/chat/completions'
      model = 'gpt-4o'
      break
    default:
      return {
        role: 'assistant',
        content: 'AI provider not configured. Please contact your administrator.',
      }
  }

  if (!apiKey) {
    return {
      role: 'assistant',
      content: 'AI API key not configured. Please contact your administrator.',
    }
  }

  try {
    if (provider === 'anthropic') {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        }),
      })
      const data = await res.json()
      return {
        role: 'assistant',
        content: data.content?.[0]?.text || 'No response generated.',
      }
    } else {
      // OpenRouter and OpenAI use the same API format
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      }
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        headers['X-Title'] = 'Client Portal AI'
      }
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          max_tokens: 1024,
        }),
      })
      const data = await res.json()
      return {
        role: 'assistant',
        content: data.choices?.[0]?.message?.content || 'No response generated.',
      }
    }
  } catch (error) {
    console.error('AI provider error:', error)
    return {
      role: 'assistant',
      content: 'Failed to get AI response. Please try again later.',
    }
  }
}
