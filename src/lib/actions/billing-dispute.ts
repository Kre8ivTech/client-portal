'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type DisputeType = 'time_logged' | 'invoice_amount' | 'coverage' | 'other'

export async function submitBillingDispute(formData: FormData) {
  const supabase = (await createServerSupabaseClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { success: false, error: 'No organization found' }
  }

  const type = formData.get('type') as DisputeType
  const subject = formData.get('subject') as string
  const description = formData.get('description') as string

  if (!type || !description?.trim()) {
    return { success: false, error: 'Type and description are required' }
  }

  const validTypes: DisputeType[] = ['time_logged', 'invoice_amount', 'coverage', 'other']
  if (!validTypes.includes(type)) {
    return { success: false, error: 'Invalid dispute type' }
  }

  const fullDescription = subject?.trim()
    ? `${subject.trim()}\n\n${description.trim()}`
    : description.trim()

  const { error } = await supabase.from('billing_disputes').insert({
    organization_id: profile.organization_id,
    submitted_by: user.id,
    dispute_type: type,
    description: fullDescription,
    status: 'pending',
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/billing')
  revalidatePath('/dashboard/billing/dispute')
  return { success: true }
}
