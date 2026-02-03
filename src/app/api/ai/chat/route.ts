import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

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
    const { conversation_id, message, organization_id } = body

    if (!conversation_id || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const [
      { data: conversationMessages },
      { data: orgDocuments },
      { data: orgRules },
      { data: aiConfigs },
    ] = await Promise.all([
      supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: true })
        .limit(20),

      supabase
        .from('ai_documents')
        .select('title, content, document_type')
        .or(`organization_id.eq.${organization_id},organization_id.is.null`)
        .limit(10),

      supabase
        .from('ai_rules')
        .select('rule_name, rule_content, priority')
        .or(`organization_id.eq.${organization_id},organization_id.is.null`)
        .eq('is_active', true)
        .order('priority', { ascending: false }),

      supabase
        .from('ai_configs')
        .select('system_prompt, model_params')
        .is('organization_id', null)
        .single()
    ])

    let systemPrompt = 'You are a helpful AI assistant for a client portal.'

    if (aiConfigs) {
      systemPrompt = aiConfigs.system_prompt || systemPrompt
    }

    if (orgRules && orgRules.length > 0) {
      systemPrompt += '\n\nIMPORTANT RULES TO FOLLOW:\n'
      orgRules.forEach((rule) => {
        systemPrompt += `- ${rule.rule_name}: ${rule.rule_content}\n`
      })
    }

    if (orgDocuments && orgDocuments.length > 0) {
      systemPrompt += '\n\nRELEVANT KNOWLEDGE BASE:\n'
      orgDocuments.forEach((doc) => {
        systemPrompt += `\n[${doc.document_type.toUpperCase()}] ${doc.title}:\n${doc.content}\n`
      })
    }

    const conversationHistory = (conversationMessages || []).map((msg: any) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }))

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...conversationHistory,
        {
          role: 'user',
          content: message,
        },
      ],
    })

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : 'I apologize, but I encountered an error processing your request.'

    return NextResponse.json({
      message: assistantMessage,
      conversation_id,
    })
  } catch (error: any) {
    console.error('AI chat error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
