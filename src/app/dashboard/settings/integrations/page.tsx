import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QuickBooksIntegration } from "@/components/settings/quickbooks-integration";
import { MarketingCredentialsForm } from "@/components/settings/marketing-credentials-form";
import { PartnerApiKeysCard } from "@/components/settings/partner-api-keys";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { SmtpConfigForm } from "@/components/settings/smtp-config-form";
import { listPartnerApiKeys } from "@/lib/actions/partner-api-keys";
import { listOrganizationProviderStatus } from "@/lib/marketing/credentials";
import { MARKETING_PROVIDERS, toPublicProviderStatus } from "@/lib/marketing/providers";
import { canManagePartnerApiKeys } from "@/lib/partner-api/scope";
import { canManageQuickBooks } from "@/lib/quickbooks/access";
import { QUICKBOOKS_SAFE_SELECT } from "@/lib/quickbooks/connection";
import { toPublicQuickBooksIntegration } from "@/lib/quickbooks/tokens";

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function IntegrationsSettingsPage({
  searchParams,
}: PageProps) {
  const supabase = await createServerSupabaseClient();
  const params = await searchParams;

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Unauthorized</div>;
  }

  // Get user role and org
  const { data: profile } = await supabase
    .from("users")
    .select("role, is_account_manager, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return <div>Profile not found</div>;
  }

  const isAccountManager = canManageQuickBooks(
    profile.role,
    Boolean(profile.is_account_manager),
  );

  const { data: organization } = profile.organization_id
    ? await supabase.from("organizations").select("type").eq("id", profile.organization_id).maybeSingle()
    : { data: null };
  const organizationType = (organization as { type: string | null } | null)?.type ?? null;
  const canManageOrgCredentials = Boolean(
    profile.organization_id &&
      canManagePartnerApiKeys({ role: profile.role, organizationType }),
  );

  // Fetch QuickBooks integration if exists
  let quickbooksIntegration = null;
  if (isAccountManager) {
    const { data } = await supabase
      .from("quickbooks_integrations")
      .select(QUICKBOOKS_SAFE_SELECT)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    quickbooksIntegration = data ? toPublicQuickBooksIntegration(data as never) : null;
  }

  const partnerKeys = canManageOrgCredentials ? await listPartnerApiKeys() : null;
  let marketingProviders = MARKETING_PROVIDERS.map((provider) => toPublicProviderStatus(provider, null));
  if (canManageOrgCredentials && profile.organization_id) {
    try {
      marketingProviders = await listOrganizationProviderStatus(profile.organization_id);
    } catch {
      marketingProviders = MARKETING_PROVIDERS.map((provider) => toPublicProviderStatus(provider, null));
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">
          Integrations
        </h2>
        <p className="text-muted-foreground mt-2">
          Connect third-party services to sync data and automate workflows.
        </p>
      </div>

      {/* Success/Error Messages */}
      {params.success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {params.success === "quickbooks_connected" &&
              "QuickBooks connected successfully!"}
          </AlertDescription>
        </Alert>
      )}

      {params.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {params.error === "missing_parameters" &&
              "Missing required parameters from QuickBooks"}
            {params.error === "invalid_state" &&
              "Invalid state parameter. Please try again."}
            {params.error === "state_expired" &&
              "Authorization expired. Please try again."}
            {params.error === "connection_failed" &&
              "Failed to connect to QuickBooks. Please try again."}
            {params.error === "database_error" &&
              "Database error. Please contact support."}
            {params.error === "unexpected_error" &&
              "An unexpected error occurred. Please try again."}
            {!params.error.startsWith("quickbooks_") &&
              !["missing_parameters", "invalid_state", "state_expired", "connection_failed", "database_error", "unexpected_error"].includes(params.error) &&
              "An error occurred. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8">
        {canManageOrgCredentials && (
          <Card>
            <CardHeader>
              <CardTitle>Google and analytics credentials</CardTitle>
              <CardDescription>
                Stored for this organization only. Secrets stay encrypted and are masked after you save them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MarketingCredentialsForm providers={marketingProviders} />
            </CardContent>
          </Card>
        )}

        {canManageOrgCredentials && (
          <Card>
            <CardHeader>
              <CardTitle>Partner API</CardTitle>
              <CardDescription>
                Create a key for this organization. It can list child client organizations and their site monitors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {partnerKeys?.ok ? (
                <PartnerApiKeysCard keys={partnerKeys.keys} />
              ) : (
                <p className="text-sm text-muted-foreground">{partnerKeys?.error ?? "API keys are unavailable."}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* QuickBooks Integration */}
        {isAccountManager ? (
          <>
            <QuickBooksIntegration
              integration={quickbooksIntegration}
              organizationId={profile.organization_id}
            />
            {profile.organization_id && (
              <SmtpConfigForm
                endpoint={`/api/organizations/${profile.organization_id}/smtp`}
                title="Organization SMTP"
                description="Use any SMTP provider for your organization's outbound email."
              />
            )}
          </>
        ) : !canManageOrgCredentials ? (
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Only account managers can configure QuickBooks. Partners and platform staff can save Google credentials and partner API keys.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contact your organization administrator to set up integrations.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
