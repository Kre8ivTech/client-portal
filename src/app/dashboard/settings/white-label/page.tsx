import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PortalBrandingForm } from "@/components/settings/portal-branding-form";
import { OrganizationBrandingForm } from "@/components/settings/organization-branding-form";
import { WhiteLabelAdminSection } from "@/components/settings/white-label-admin-section";
import { getPortalBranding } from "@/lib/actions/portal-branding";
import { redirect } from "next/navigation";

export default async function WhiteLabelSettingsPage() {
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

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("id, name, avatar_url, organization_name, organization_slug")
    .eq("id", user.id)
    .single();

  const userRow = userData as { id: string; role: string; organization_id: string | null } | null;
  const profileRow = profileData as { id: string; name: string | null; avatar_url: string | null; organization_name: string | null; organization_slug: string | null } | null;

  const profile =
    userRow && profileRow
      ? {
          id: userRow.id,
          role: userRow.role,
          name: profileRow.name,
          avatar_url: profileRow.avatar_url,
          organization_name: profileRow.organization_name,
          organization_slug: profileRow.organization_slug,
        }
      : null;

  // Fetch the full organization with branding_config for partners
  type OrganizationRow = {
    id: string;
    name: string;
    slug: string;
    type: string;
    branding_config: { logo_url?: string | null; primary_color?: string | null } | null;
  };
  let organization: OrganizationRow | null = null;
  if (userRow?.organization_id) {
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, name, slug, type, branding_config")
      .eq("id", userRow.organization_id)
      .single();
    organization = orgData as OrganizationRow | null;
  }
  const role = profile?.role ?? "client";
  const isSuperAdmin = role === "super_admin";
  const isStaffOrAdmin = role === "staff" || role === "super_admin";
  const isPartner = role === "partner" || role === "partner_staff";
  const canSeeBranding = isStaffOrAdmin || isPartner;

  // Fetch all organizations for staff/admin to edit
  let allOrganizations: OrganizationRow[] = [];
  if (isStaffOrAdmin) {
    const { data: orgsData } = await supabase
      .from("organizations")
      .select("id, name, slug, type, branding_config")
      .order("name", { ascending: true });
    allOrganizations = (orgsData ?? []) as OrganizationRow[];
  }

  // If user doesn't have access to branding, redirect to general settings
  if (!canSeeBranding) {
    redirect("/dashboard/settings");
  }

  const portalBranding = isSuperAdmin ? await getPortalBranding() : null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">White Label Settings</h2>
        <p className="text-muted-foreground mt-2">
          Customize the look and feel of your portal.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Super Admin: Portal-wide branding */}
        {isSuperAdmin && portalBranding && <PortalBrandingForm branding={portalBranding} />}

        {/* Staff/Admin: Edit any organization's branding */}
        {isStaffOrAdmin && allOrganizations.length > 0 && (
          <WhiteLabelAdminSection organizations={allOrganizations} />
        )}

        {/* Organization branding - partners can edit their own branding */}
        {isPartner && organization && (
          <OrganizationBrandingForm
            organization={organization}
            canEdit={true}
          />
        )}
      </div>
    </div>
  );
}
