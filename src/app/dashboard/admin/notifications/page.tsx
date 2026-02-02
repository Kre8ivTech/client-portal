import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NotificationForm } from '@/components/admin/notification-form'
import { NotificationList } from '@/components/admin/notification-list'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const dynamic = 'force-dynamic'

export default async function NotificationsManagementPage() {
  const supabase = await createServerSupabaseClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile with role
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('role, is_account_manager, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/dashboard')
  }

  const isAdmin = profile.role === 'super_admin'
  const isAccountManager = profile.is_account_manager
  const isStaff = profile.role === 'staff' || profile.role === 'partner_staff'

  // Only admins, account managers, and staff can access this page
  if (!isAdmin && !isAccountManager && !isStaff) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notification Management</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage system-wide notifications and announcements
        </p>
      </div>

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList>
          <TabsTrigger value="create">Create Notification</TabsTrigger>
          <TabsTrigger value="manage">Manage Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <NotificationForm
            userRole={profile.role}
            isAccountManager={isAccountManager}
            organizationId={profile.organization_id}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permission Guide</CardTitle>
              <CardDescription>Who can send notifications to whom</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">Admin (Super Admin)</p>
                  <p className="text-muted-foreground">
                    Can send notifications to anyone - all users, specific clients, specific staff, or individual users
                  </p>
                </div>
                <div>
                  <p className="font-medium">Account Manager</p>
                  <p className="text-muted-foreground">
                    Can send notifications to staff and admin only
                  </p>
                </div>
                <div>
                  <p className="font-medium">Project Manager / Staff</p>
                  <p className="text-muted-foreground">
                    Can send notifications to assigned staff and clients
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <NotificationList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
