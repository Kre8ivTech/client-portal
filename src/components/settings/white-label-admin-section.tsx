"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrganizationBrandingForm } from "@/components/settings/organization-branding-form";
import { SmtpConfigForm } from "@/components/settings/smtp-config-form";
import { Building2 } from "lucide-react";

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

interface WhiteLabelAdminSectionProps {
  organizations: Organization[];
}

export function WhiteLabelAdminSection({ organizations }: WhiteLabelAdminSectionProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    organizations.length > 0 ? organizations[0].id : null
  );

  // Reset selected org if organizations list changes or becomes empty
  useEffect(() => {
    if (organizations.length === 0) {
      setSelectedOrgId(null);
    } else if (!organizations.find((org) => org.id === selectedOrgId)) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  const selectedOrg = organizations.find((org) => org.id === selectedOrgId);

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 border-b">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="text-primary w-5 h-5" />
          Organization Branding Management
        </CardTitle>
        <CardDescription>
          Select an organization to edit its white label branding settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="organization-select">Select Organization</Label>
          <Select
            value={selectedOrgId ?? undefined}
            onValueChange={setSelectedOrgId}
          >
            <SelectTrigger id="organization-select" className="w-full">
              <SelectValue placeholder="Select an organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name} ({org.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedOrg && (
          <div className="pt-4 border-t">
            <OrganizationBrandingForm
              organization={selectedOrg}
              canEdit={true}
              canManageDomainVerification={true}
            />
            {selectedOrg.type === "partner" && (
              <div className="mt-6">
                <SmtpConfigForm
                  endpoint={`/api/organizations/${selectedOrg.id}/smtp`}
                  title="Organization SMTP (White Label)"
                  description="Configure a custom SMTP provider for this partner's branded emails."
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
