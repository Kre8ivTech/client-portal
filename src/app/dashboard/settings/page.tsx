import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { CalendarOfficeHours } from "@/components/settings/calendar-office-hours";
import { AdminAccessInfo } from "@/components/settings/admin-access-info";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single();

  const userRow = userData as { id: string; role: string; organization_id: string | null } | null;
  const role = userRow?.role ?? "client";
  const isStaffOrAdmin = role === "staff" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">General Settings</h2>
        <p className="text-muted-foreground mt-2">
          Manage your general account and system settings.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Admin: how admin login works */}
        {isSuperAdmin && <AdminAccessInfo />}

        {/* Calendar & Office Hours - Staff/Admin only */}
        {isStaffOrAdmin && <CalendarOfficeHours profileId={user.id} />}

        {/* General settings placeholder for all users */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Settings className="text-primary w-5 h-5" />
              General Preferences
            </CardTitle>
            <CardDescription>
              Configure your general account preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Additional settings can be found in the navigation menu:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>White Label - Customize portal branding</li>
              <li>Security - Manage security and authentication settings</li>
              <li>Notifications - Configure notification preferences</li>
              <li>Integrations - Connect third-party services</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
