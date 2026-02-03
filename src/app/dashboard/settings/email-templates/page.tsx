import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EmailTemplateList } from '@/components/settings/email-template-list'

type UserRole = 'super_admin' | 'staff' | 'partner' | 'partner_staff' | 'client'

export default async function EmailTemplatesPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  const role = userData?.role as UserRole | null
  const isStaffOrAdmin = role === 'staff' || role === 'super_admin'

  if (!isStaffOrAdmin) {
    redirect('/dashboard/settings')
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">Email Templates</h2>
        <p className="text-muted-foreground mt-2">
          Customize email templates for notifications, invoices, and other communications.
        </p>
      </div>

      <EmailTemplateList
        isSuperAdmin={role === 'super_admin'}
        organizationId={userData?.organization_id || null}
      />
    </div>
  )
}
