import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { CalendarOfficeHours } from "@/components/settings/calendar-office-hours";
import { AdminAccessInfo } from "@/components/settings/admin-access-info";
import { GeneralPreferences } from "@/components/settings/general-preferences";
import { getAppSettings } from "@/lib/actions/app-settings";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("id, role, organization_id, timezone")
    .eq("id", user.id)
    .single();

  const userRow = userData as {
    id: string;
    role: string;
    organization_id: string | null;
    timezone?: string | null;
  } | null;
  const role = userRow?.role ?? "client";
  const userTimezone = userRow?.timezone ?? null;
  const isStaffOrAdmin = role === "staff" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  const appSettings = await getAppSettings();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">General Settings</h2>
        <p className="text-muted-foreground mt-2">Manage your general account and system settings.</p>
      </div>

      <div className="grid gap-8">
        {/* Admin: how admin login works */}
        {isSuperAdmin && <AdminAccessInfo />}

        {/* Calendar & Office Hours - Staff/Admin only */}
        {isStaffOrAdmin && <CalendarOfficeHours profileId={user.id} />}

        {/* General preferences */}
        <GeneralPreferences
          initialTimezone={appSettings.timezone}
          userTimezone={userTimezone}
          isSuperAdmin={isSuperAdmin}
        />
      </div>
    </div>
  );
}
