import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CreateTicketForm } from '@/components/tickets/create-ticket-form'
import { redirect } from 'next/navigation'

export default async function NewTicketPage() {
  const supabase = (await createServerSupabaseClient()) as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const organizationId = profile?.organization_id ?? null

  if (!organizationId) {
    // In a real app, users always have an organization in this system
    // but we handle the edge case.
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Organization Required</h1>
        <p className="text-slate-500">Your account must be associated with an organization to create tickets.</p>
      </div>
    )
  }

  return (
    <CreateTicketForm 
      organizationId={organizationId} 
      userId={user.id} 
    />
  )
}
