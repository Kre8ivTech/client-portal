import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SecuritySettings } from "@/components/settings/security-settings";
import { redirect } from "next/navigation";

export default async function SecuritySettingsPage() {
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
  const organizationId = userRow?.organization_id;
  const isStaffOrAdmin = role === "staff" || role === "super_admin";
  const isPartner = role === "partner" || role === "partner_staff";

  // If user doesn't have access to security settings, redirect to general settings
  if (!organizationId || (!isStaffOrAdmin && !isPartner)) {
    redirect("/dashboard/settings");
  }

  // Get organization settings
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .single();
  
  const orgData = org as { settings: any } | null;
  const organizationSettings = orgData?.settings || {};

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">Security Settings</h2>
        <p className="text-muted-foreground mt-2">
          Manage security and authentication settings for your organization.
        </p>
      </div>

      <div className="grid gap-8">
        {/* @ts-ignore */}
        <SecuritySettings 
          organizationId={organizationId} 
          // @ts-ignore
          settings={organizationSettings?.security} 
        />
      </div>
    </div>
  );
}
