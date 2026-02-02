"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Palette, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { updateOrganization } from "@/lib/actions/organization";

type Organization = {
  id: string;
  name: string;
  slug: string;
  branding_config?: {
    logo_url?: string | null;
    primary_color?: string | null;
  } | null;
};

interface OrganizationBrandingFormProps {
  organization: Organization;
  canEdit: boolean;
}

export function OrganizationBrandingForm({ organization, canEdit }: OrganizationBrandingFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to update branding." });
    }
  }

  const branding = organization.branding_config ?? {};

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
            </div>
          </div>

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
