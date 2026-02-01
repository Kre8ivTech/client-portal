import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Globe, Palette, ShieldCheck } from "lucide-react";
import { CalendarOfficeHours } from "@/components/settings/calendar-office-hours";
import { PortalBrandingForm } from "@/components/settings/portal-branding-form";
import { AdminAccessInfo } from "@/components/settings/admin-access-info";
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
  ] = await Promise.all([
    supabase.from("users").select("id, role").eq("id", user.id).single(),
    supabase.from("user_profiles").select("id, name, avatar_url, organization_name, organization_slug").eq("id", user.id).single(),
  ]);
  const userRow = userData as { id: string; role: string } | null;
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

        {/* Organization branding - non-admin only (admin uses Portal Branding above) */}
        {!isSuperAdmin && (
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

        {/* Domain & Network Section */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Globe className="text-primary w-5 h-5" />
              Domain & URL
            </CardTitle>
            <CardDescription>Setup custom domains and subdomains for your white-labeled portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-slate-800">Current Portal URL</p>
                  <code className="text-xs text-primary font-mono bg-primary/5 px-2 py-1 rounded">
                  {process.env.NEXT_PUBLIC_APP_URL
                    ? process.env.NEXT_PUBLIC_APP_URL
                    : "[set NEXT_PUBLIC_APP_URL]"}
                </code>
                </div>
                <div className="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold uppercase rounded border border-green-100">Active</div>
              </div>
            </div>
            <div className="space-y-2 pt-4">
              <Label className="text-slate-700">Custom Domain</Label>
              <div className="flex gap-2">
                <Input placeholder="portal.yourdomain.com" className="bg-white border-slate-200" />
                <Button variant="outline">Connect</Button>
              </div>
              <p className="text-[10px] text-slate-500">Requires CNAME record pointing to our edge network infrastructure.</p>
            </div>
          </CardContent>
        </Card>

        {/* Security / System Section */}
        <Card className="border-slate-200 shadow-sm opacity-60 grayscale-[0.5]">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <ShieldCheck className="text-primary w-5 h-5" />
                  Advanced Security
                </CardTitle>
                <CardDescription>2FA, IP Whitelisting, and SSO integration.</CardDescription>
              </div>
              <div className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase rounded border border-amber-100">Enterprise</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 grayscale text-slate-400">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div className="space-y-1">
                <p className="text-sm font-medium">Single Sign-On (SAML/OpenID)</p>
                <p className="text-xs">Connect your corporate identity provider.</p>
              </div>
              <Button size="sm" variant="outline" disabled>Configure</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
