'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import { requireRole } from '@/lib/require-role'

export type CreateDeliverableData = {
  ticket_id: string
  title: string
  description?: string
  file_url?: string
  preview_url?: string
}

export async function createDeliverable(data: CreateDeliverableData) {
  // Only staff/partners can create deliverables
  await requireRole(['super_admin', 'staff', 'partner', 'partner_staff'])

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const { data: deliverable, error } = await (supabase as any)
      .from('deliverables')
      .insert({
        ticket_id: data.ticket_id,
        title: data.title,
        description: data.description,
        file_url: data.file_url,
        preview_url: data.preview_url,
        created_by: user.id,
        status: 'pending_review',
        version: 1
      })
      .select()
      .single()

    if (error) throw error

    // Create a system comment on the ticket
    await (supabase as any).from('ticket_comments').insert({
      ticket_id: data.ticket_id,
      author_id: user.id,
      content: `New deliverable uploaded: ${data.title}`,
      is_internal: false
    })

    await writeAuditLog({
      action: 'deliverable.create',
      entity_type: 'deliverable',
      entity_id: deliverable.id,
      details: { ticket_id: data.ticket_id, title: data.title }
    })

    revalidatePath(`/dashboard/tickets/${data.ticket_id}`)
    revalidatePath(`/dashboard/contracts/${data.ticket_id}`) // In case it's linked
    return { success: true, data: deliverable }
  } catch (error: any) {
    console.error('Create deliverable error:', error)
    return { success: false, error: error.message }
  }
}

export type ReviewDeliverableData = {
  deliverable_id: string
  status: 'approved' | 'changes_requested'
  feedback?: string
}

export async function reviewDeliverable(data: ReviewDeliverableData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    // Check if user has access to the deliverable
    const { data: deliverable, error: fetchError } = await (supabase as any)
      .from('deliverables')
      .select('*, tickets(id, organization_id)')
      .eq('id', data.deliverable_id)
      .single()

    if (fetchError || !deliverable) throw new Error('Deliverable not found')

    // Update status
    const { error } = await (supabase as any)
      .from('deliverables')
      .update({
        status: data.status,
        client_feedback: data.feedback,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.deliverable_id)

    if (error) throw error

    // Create a notification comment
    const actionText = data.status === 'approved' ? 'approved' : 'requested changes for'
    await (supabase as any).from('ticket_comments').insert({
      ticket_id: deliverable.ticket_id,
      author_id: user.id,
      content: `User ${actionText} the deliverable: ${deliverable.title}. \n\nFeedback: ${data.feedback || 'No feedback provided.'}`,
      is_internal: false
    })

    await writeAuditLog({
      action: `deliverable.${data.status}`,
      entity_type: 'deliverable',
      entity_id: data.deliverable_id,
      details: { ticket_id: deliverable.ticket_id, feedback: data.feedback }
    })

    revalidatePath(`/dashboard/tickets/${deliverable.ticket_id}`)
    return { success: true }
  } catch (error: any) {
    console.error('Review deliverable error:', error)
    return { success: false, error: error.message }
  }
}
