import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SecuritySettings } from "@/components/settings/security-settings";
import { PersonalSecuritySettings } from "@/components/settings/personal-security-settings";

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
  const canManageOrgSecurity = isStaffOrAdmin || isPartner;

  // Get organization settings if user can manage them
  let organizationSettings: any = {};
  if (canManageOrgSecurity && organizationId) {
    const { data: org } = await supabase.from("organizations").select("settings").eq("id", organizationId).single();

    const orgData = org as { settings: any } | null;
    organizationSettings = orgData?.settings || {};
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">Security Settings</h2>
        <p className="text-muted-foreground mt-2">Manage your account security and authentication settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Security - Available to all users */}
        <PersonalSecuritySettings userEmail={user.email || ""} />

        {/* Organization Security - Staff/Admin/Partner only */}
        {canManageOrgSecurity && organizationId && (
          <SecuritySettings organizationId={organizationId} settings={organizationSettings?.security} />
        )}
      </div>
    </div>
  );
}
