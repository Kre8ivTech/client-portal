import { NotificationPreferences } from '@/components/settings/notification-preferences'
import { OrgNotificationSettings } from '@/components/settings/org-notification-settings'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type UserRole = 'super_admin' | 'staff' | 'partner' | 'partner_staff' | 'client'

export default async function NotificationsSettingsPage() {
  const supabase = await createServerSupabaseClient()
  
  // Check if user is staff/admin to show org settings
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isStaff = false
  if (user) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = userData?.role as UserRole | null
    isStaff = role === 'staff' || role === 'super_admin'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">Notification Settings</h2>
        <p className="text-muted-foreground mt-2">
          Manage how and when you receive notifications across multiple channels.
        </p>
      </div>

      {isStaff ? (
        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="personal">Personal Notifications</TabsTrigger>
            <TabsTrigger value="organization">Organization Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="personal">
            <NotificationPreferences />
          </TabsContent>
          <TabsContent value="organization">
            <OrgNotificationSettings />
          </TabsContent>
        </Tabs>
      ) : (
        <NotificationPreferences />
      )}
    </div>
  );
}
