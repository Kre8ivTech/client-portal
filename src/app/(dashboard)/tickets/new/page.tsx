import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CreateTicketForm } from '@/components/tickets/create-ticket-form'
import { redirect } from 'next/navigation'

export default async function NewTicketPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  return <CreateTicketForm />
}
