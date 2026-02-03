import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SLAMonitoringSettings } from '@/components/admin/sla-monitoring-settings'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Shield } from 'lucide-react'

export default async function AdminSLASettingsPage() {
  const supabase = await createServerSupabaseClient()

  // Check if user is super admin
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'super_admin') {
    redirect('/dashboard')
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight">SLA Monitoring Settings</h2>
        </div>
        <p className="text-muted-foreground">
          Configure automated SLA checks, cron schedules, and notification thresholds.
        </p>
      </div>

      <Alert>
        <AlertTitle>Administrator Access</AlertTitle>
        <AlertDescription>
          These settings affect the entire system. Changes will apply to all tickets and
          organizations. Please review carefully before saving.
        </AlertDescription>
      </Alert>

      <SLAMonitoringSettings />
    </div>
  )
}
