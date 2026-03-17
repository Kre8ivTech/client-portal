"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Palette, Loader2, CheckCircle2, AlertCircle, Globe2, ShieldCheck } from "lucide-react";
import { updateOrganization } from "@/lib/actions/organization";

type Organization = {
  id: string;
  name: string;
  slug: string;
  type: string;
  custom_domain?: string | null;
  custom_domain_verified?: boolean | null;
  branding_config?: {
    app_name?: string | null;
    tagline?: string | null;
    logo_url?: string | null;
    primary_color?: string | null;
    login_bg_color?: string | null;
    login_bg_image_url?: string | null;
    login_bg_overlay_opacity?: number | null;
  } | null;
};

interface OrganizationBrandingFormProps {
  organization: Organization;
  canEdit: boolean;
  canManageDomainVerification?: boolean;
}

export function OrganizationBrandingForm({ organization, canEdit, canManageDomainVerification = false }: OrganizationBrandingFormProps) {
  const [loading, setLoading] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [domainVerified, setDomainVerified] = useState(Boolean(organization.custom_domain_verified));
  const [domainVerificationNote, setDomainVerificationNote] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const cnameTarget = useMemo(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return "app.ktportal.app";
    try {
      return new URL(appUrl).hostname;
    } catch {
      return appUrl.replace(/^https?:\/\//, "").split("/")[0] || "app.ktportal.app";
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;

    setLoading(true);
    setMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Include organization name and slug to satisfy validation
    formData.set("name", organization.name);
    formData.set("slug", organization.slug);

    const result = await updateOrganization(organization.id, formData);

    setLoading(false);
    if (result.success) {
      setMessage({ type: "success", text: "Organization branding updated successfully." });
      setDomainVerified(false);
      setDomainVerificationNote("Domain verification is reset after custom domain changes.");
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to update branding." });
    }
  }

  async function handleVerifyDomain() {
    setVerifyingDomain(true);
    setDomainVerificationNote(null);
    setMessage(null);

    try {
      const response = await fetch("/api/white-label/domains/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organization.id }),
      });

      const data = (await response.json()) as {
        error?: string;
        verified?: boolean;
        records?: string[];
        expectedTargets?: string[];
        reason?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Could not verify custom domain");
      }

      const verified = Boolean(data.verified);
      setDomainVerified(verified);

      if (verified) {
        setMessage({ type: "success", text: "Custom domain verified successfully." });
        setDomainVerificationNote(
          data.records?.length
            ? `Detected CNAME: ${data.records.join(", ")}`
            : "DNS verification succeeded."
        );
      } else {
        setMessage({ type: "error", text: "Custom domain is not yet pointing to the required CNAME target." });
        setDomainVerificationNote(
          data.reason ||
            (data.expectedTargets?.length
              ? `Expected target: ${data.expectedTargets.join(" or ")}`
              : "No expected target is configured on the server.")
        );
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not verify custom domain",
      });
    } finally {
      setVerifyingDomain(false);
    }
  }

  const branding = organization.branding_config ?? {};
  const canToggleDomainVerification = organization.type === "partner" && canManageDomainVerification;

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 border-b">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Palette className="text-primary w-5 h-5" />
          Organization Branding
        </CardTitle>
        <CardDescription>
          {canEdit
            ? "Customize the look and feel of your organization."
            : "View organization branding. Contact an administrator to make changes."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org_name_display">Organization Name</Label>
                <Input
                  id="org_name_display"
                  value={organization.name}
                  className="bg-muted/50"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Contact support to change your organization name.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="branding_app_name">Portal Name</Label>
                <Input
                  id="branding_app_name"
                  name="branding_app_name"
                  defaultValue={branding.app_name ?? ""}
                  placeholder={organization.name}
                  className="bg-background"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branding_tagline">Tagline</Label>
                <Input
                  id="branding_tagline"
                  name="branding_tagline"
                  defaultValue={branding.tagline ?? ""}
                  placeholder="Client Portal"
                  className="bg-background"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input
                  id="logo_url"
                  name="logo_url"
                  type="url"
                  defaultValue={branding.logo_url ?? ""}
                  placeholder="https://example.com/logo.png"
                  className="bg-background"
                  disabled={!canEdit}
                />
                {branding.logo_url && (
                  <div className="mt-2 h-12 flex items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={branding.logo_url}
                      alt="Logo preview"
                      className="max-h-10 max-w-[100px] object-contain"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="primary_color"
                    name="primary_color"
                    defaultValue={branding.primary_color ?? ""}
                    placeholder="#556ee6"
                    className="bg-background flex-1"
                    disabled={!canEdit}
                  />
                  <div
                    className="h-10 w-10 shrink-0 rounded-md border border-border"
                    style={{ backgroundColor: branding.primary_color || "#556ee6" }}
                    title="Color preview"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter a hex color code (e.g., #556ee6)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login_bg_color">Login Background Color</Label>
                <Input
                  id="login_bg_color"
                  name="login_bg_color"
                  defaultValue={branding.login_bg_color ?? ""}
                  placeholder="#0f172a"
                  className="bg-background"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login_bg_image_url">Login Background Image URL</Label>
                <Input
                  id="login_bg_image_url"
                  name="login_bg_image_url"
                  type="url"
                  defaultValue={branding.login_bg_image_url ?? ""}
                  placeholder="https://example.com/hero.jpg"
                  className="bg-background"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login_bg_overlay_opacity">Overlay Opacity (0-1)</Label>
                <Input
                  id="login_bg_overlay_opacity"
                  name="login_bg_overlay_opacity"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  defaultValue={branding.login_bg_overlay_opacity ?? 0.5}
                  className="bg-background"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>

          {organization.type === "partner" && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="rounded-md border border-info/30 bg-info/10 p-3">
                <div className="flex items-start gap-2">
                  <Globe2 className="mt-0.5 h-4 w-4 text-info" />
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-info">CNAME setup checklist</p>
                    <p className="text-foreground/80">1. Create a CNAME for your subdomain (example: `portal.youragency.com`).</p>
                    <p className="text-foreground/80">2. Point it to `<span className="font-mono">{cnameTarget}</span>`.</p>
                    <p className="text-foreground/80">3. Save settings, wait for DNS propagation, then click Verify now.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom_domain">Custom Domain (CNAME)</Label>
                <Input
                  id="custom_domain"
                  name="custom_domain"
                  defaultValue={organization.custom_domain ?? ""}
                  placeholder="portal.youragency.com"
                  className="bg-background"
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground">
                  Point a CNAME from your domain to this portal host. Changes reset verification until DNS is rechecked.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="custom_domain_verified"
                  name="custom_domain_verified"
                  type="checkbox"
                  checked={domainVerified}
                  onChange={(e) => setDomainVerified(e.target.checked)}
                  disabled={!canEdit || !canToggleDomainVerification}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="custom_domain_verified" className="text-sm">
                  Domain verified {domainVerified ? "(active)" : "(pending)"}
                </Label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="info"
                  onClick={handleVerifyDomain}
                  disabled={verifyingDomain || !canEdit}
                >
                  {verifyingDomain ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Verify now
                    </>
                  )}
                </Button>
                {domainVerificationNote && <p className="text-xs text-muted-foreground">{domainVerificationNote}</p>}
              </div>
              {!canManageDomainVerification && (
                <p className="text-xs text-muted-foreground">
                  Verification is completed by platform staff after DNS propagation.
                </p>
              )}
            </div>
          )}

          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              {message.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {canEdit && (
            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Branding"
                )}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
