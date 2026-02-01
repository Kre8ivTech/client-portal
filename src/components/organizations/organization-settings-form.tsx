"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Building2, Loader2, CheckCircle2, AlertCircle, Mail, Phone, MapPin, Palette } from "lucide-react";
import { updateOrganization } from "@/lib/actions/organization";

type Organization = {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  branding_config?: {
    logo_url?: string | null;
    primary_color?: string | null;
  } | null;
  settings?: {
    contact_email?: string | null;
    contact_phone?: string | null;
    billing_address?: {
      street?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    } | null;
  } | null;
};

interface OrganizationSettingsFormProps {
  organization: Organization;
  canEdit: boolean;
  userRole?: string; // Add user role to check visibility
}

export function OrganizationSettingsForm({ organization, canEdit, userRole = "client" }: OrganizationSettingsFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Only show branding to admin/staff/partners, not clients
  const canSeeBranding = ["super_admin", "staff", "partner", "partner_staff"].includes(userRole);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;

    setLoading(true);
    setMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const result = await updateOrganization(organization.id, formData);

    setLoading(false);
    if (result.success) {
      setMessage({ type: "success", text: "Organization settings updated successfully." });
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to update organization." });
    }
  }

  const settings = organization.settings ?? {};
  const branding = organization.branding_config ?? {};
  const billingAddress = settings.billing_address ?? {};

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 border-b">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="text-primary w-5 h-5" />
          Organization Settings
        </CardTitle>
        <CardDescription>
          {canEdit
            ? "Edit organization details, contact information, and branding."
            : "View organization details. Contact an administrator to make changes."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Basic Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={organization.name}
                  placeholder="Acme Corp"
                  className="bg-background"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={organization.slug}
                  placeholder="acme-corp"
                  className="bg-background font-mono text-sm"
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground">
                  Used in URLs. Lowercase letters, numbers, and hyphens only.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Contact Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  defaultValue={settings.contact_email ?? ""}
                  placeholder="contact@example.com"
                  className="bg-background"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  name="contact_phone"
                  type="tel"
                  defaultValue={settings.contact_phone ?? ""}
                  placeholder="+1 (555) 123-4567"
                  className="bg-background"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Billing Address */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Billing Address
            </h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="billing_street">Street Address</Label>
                <Input
                  id="billing_street"
                  name="billing_street"
                  defaultValue={billingAddress.street ?? ""}
                  placeholder="123 Main St"
                  className="bg-background"
                  disabled={!canEdit}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="billing_city">City</Label>
                  <Input
                    id="billing_city"
                    name="billing_city"
                    defaultValue={billingAddress.city ?? ""}
                    placeholder="San Francisco"
                    className="bg-background"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_state">State / Province</Label>
                  <Input
                    id="billing_state"
                    name="billing_state"
                    defaultValue={billingAddress.state ?? ""}
                    placeholder="CA"
                    className="bg-background"
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="billing_postal_code">Postal Code</Label>
                  <Input
                    id="billing_postal_code"
                    name="billing_postal_code"
                    defaultValue={billingAddress.postal_code ?? ""}
                    placeholder="94102"
                    className="bg-background"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_country">Country</Label>
                  <Input
                    id="billing_country"
                    name="billing_country"
                    defaultValue={billingAddress.country ?? ""}
                    placeholder="United States"
                    className="bg-background"
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Branding - Only show for partners AND only to admin/staff/partner roles (not clients) */}
          {organization.type === "partner" && canSeeBranding && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Branding
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
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
                      {branding.primary_color && (
                        <div
                          className="h-10 w-10 shrink-0 rounded-md border border-border"
                          style={{ backgroundColor: branding.primary_color }}
                          title="Preview"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
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
                  "Save Changes"
                )}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
