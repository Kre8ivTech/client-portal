import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Globe, Palette } from "lucide-react";
import { PortalBrandingForm } from "@/components/settings/portal-branding-form";
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

  const organization = profile ? { name: profile.organization_name, slug: profile.organization_slug } : null;
  const role = profile?.role ?? "client";
  const isSuperAdmin = role === "super_admin";
  const isStaffOrAdmin = role === "staff" || role === "super_admin";
  const isPartner = role === "partner" || role === "partner_staff";
  const canSeeBranding = isStaffOrAdmin || isPartner;

  // If user doesn't have access to branding, redirect to general settings
  if (!canSeeBranding) {
    redirect("/dashboard/settings");
  }

  const portalBranding = isSuperAdmin ? await getPortalBranding() : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">White Label Settings</h2>
        <p className="text-muted-foreground mt-2">
          Customize the look and feel of your portal.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Super Admin: Portal-wide branding */}
        {isSuperAdmin && portalBranding && <PortalBrandingForm branding={portalBranding} />}

        {/* Organization branding - admin/staff/partners (NOT super_admin, NOT clients) */}
        {canSeeBranding && !isSuperAdmin && (
          <Card className="border-border shadow-sm overflow-hidden">
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
      </div>
    </div>
  );
}
