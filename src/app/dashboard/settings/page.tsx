import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Globe, Palette, ShieldCheck } from "lucide-react";
import { CalendarOfficeHours } from "@/components/settings/calendar-office-hours";
import { PortalBrandingForm } from "@/components/settings/portal-branding-form";
import { AdminAccessInfo } from "@/components/settings/admin-access-info";
import { SecuritySettings } from "@/components/settings/security-settings";
import { getPortalBranding } from "@/lib/actions/portal-branding";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    { data: userData },
    { data: profileData },
    { data: orgData }
  ] = await Promise.all([
    supabase.from("users").select("id, role, organization_id").eq("id", user.id).single(),
    supabase.from("user_profiles").select("id, name, avatar_url, organization_name, organization_slug").eq("id", user.id).single(),
    supabase.from("organizations").select("id, settings").eq("id", user?.user_metadata?.organization_id || user?.id /* fallback if needed, though organization_id should exist */).single() // logic check below
  ]);

  // Fix organization fetch logic
  const userRow = userData as { id: string; role: string; organization_id: string | null } | null;
  const organizationId = userRow?.organization_id;
  let organizationSettings = {};
  
  if (organizationId) {
     const { data: org } = await supabase.from("organizations").select("settings").eq("id", organizationId).single();
     const orgData = org as { settings: any } | null;
     organizationSettings = orgData?.settings || {};
  }

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
  const organization = profile ? { name: profile.organization_name, slug: profile.organization_slug } : null;
  const role = profile?.role ?? "client";
  const isStaffOrAdmin = role === "staff" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";
  const isPartner = role === "partner" || role === "partner_staff";
  const canSeeBranding = isStaffOrAdmin || isPartner; // Admin, staff, and partners can see branding
  const portalBranding = isSuperAdmin ? await getPortalBranding() : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">Settings</h2>
        <p className="text-muted-foreground mt-2">
          Manage your organization and portal-wide configurations.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Admin: how admin login works + portal branding */}
        {isSuperAdmin && (
          <>
            <AdminAccessInfo />
            {portalBranding && <PortalBrandingForm branding={portalBranding} />}
          </>
        )}

        {/* Calendar & Office Hours - Staff/Admin only */}
        {isStaffOrAdmin && <CalendarOfficeHours profileId={user.id} />}

        {/* Organization branding - admin/staff/partners only (NOT clients) */}
        {canSeeBranding && !isSuperAdmin && (
          <Card id="white-label" className="border-border shadow-sm overflow-hidden scroll-mt-20">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Palette className="text-primary w-5 h-5" />
                Organization Branding
              </CardTitle>
              <CardDescription>
                Customize the look and feel of your organization (contact admin for portal-wide changes).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input defaultValue={organization?.name ?? ""} className="bg-background" readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input defaultValue="#556ee6" className="bg-background" readOnly />
                      <div className="h-10 w-10 shrink-0 rounded-md border border-border bg-primary" />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <Label>Logo</Label>
                  <div className="h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
                    <Globe size={24} className="mb-2 opacity-20" />
                    <p className="text-xs">Portal branding is managed by the administrator.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security / System Section */}
        {organizationId && (isStaffOrAdmin || isPartner) && (
          // @ts-ignore
          <SecuritySettings 
            organizationId={organizationId} 
            // @ts-ignore
            settings={organizationSettings?.security} 
          />
        )}
      </div>
    </div>
  )
}
