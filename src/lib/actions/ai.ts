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

export async function getAIResponse(messages: any[]) {
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
    
  const systemPrompt = (config as any)?.system_prompt || "You are a helpful assistant."
  
  // 3. Simulate AI Response (Mock)
  // In a real app, this would call OpenAI/Anthropic
  // We will return a simulated response that proves we used the prompt.
  
  const lastUserMessage = messages[messages.length - 1].content
  
  await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate network delay
  
  let responseContent = ""
  
  if (lastUserMessage.toLowerCase().includes('server')) {
    responseContent = `[AI Simulation based on Role: ${userRole}]\n\nBased on your role, I can tell you that the server status is stable. \n\n(System Context: ${systemPrompt.substring(0, 50)}...)`
  } else if (lastUserMessage.toLowerCase().includes('invoice')) {
    responseContent = `[AI Simulation based on Role: ${userRole}]\n\nYou can find invoices in the Billing section. \n\n(System Context: ${systemPrompt.substring(0, 50)}...)`
  } else {
    responseContent = `[AI Simulation based on Role: ${userRole}]\n\nI understand you are asking about "${lastUserMessage}". \n\nMy instructions are: "${systemPrompt}"\n\nHow else can I help you?`
  }
  
  return { 
    role: 'assistant', 
    content: responseContent
  }
}
