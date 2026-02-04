import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QuickBooksIntegration } from "@/components/settings/quickbooks-integration";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle } from "lucide-react";

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

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_account_manager, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return <div>Profile not found</div>;
  }

  const isAccountManager =
    profile.role === "super_admin" ||
    (profile.role === "staff" && profile.is_account_manager);

  // Fetch QuickBooks integration if exists
  let quickbooksIntegration = null;
  if (isAccountManager) {
    const { data } = await supabase
      .from("quickbooks_integrations")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .single();
    quickbooksIntegration = data;
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
        {/* QuickBooks Integration */}
        {isAccountManager ? (
          <QuickBooksIntegration
            integration={quickbooksIntegration}
            organizationId={profile.organization_id}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Only account managers can configure integrations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contact your organization administrator to set up integrations.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
