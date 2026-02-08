import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QuickBooksAppConfigForm } from "@/components/admin/quickbooks-app-config-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function AdminIntegrationsSettingsPage({
  searchParams,
}: PageProps) {
  const supabase = await createServerSupabaseClient();
  const params = await searchParams;

  // Check authentication and authorization
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Unauthorized</div>;
  }

  // Get user role
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Only super administrators can access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fetch existing QuickBooks app config (global)
  const { data: existingConfig } = await supabase
    .from("quickbooks_app_config")
    .select("*")
    .is("organization_id", null)
    .single();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">
          Integration Settings
        </h2>
        <p className="text-muted-foreground mt-2">
          Configure third-party integration credentials for all organizations.
        </p>
      </div>

      {/* Success/Error Messages */}
      {params.success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {params.success === "config_saved" &&
              "QuickBooks configuration saved successfully!"}
            {params.success === "config_deleted" &&
              "QuickBooks configuration deleted successfully!"}
          </AlertDescription>
        </Alert>
      )}

      {params.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {params.error === "save_failed" &&
              "Failed to save configuration. Please try again."}
            {params.error === "delete_failed" &&
              "Failed to delete configuration. Please try again."}
            {params.error === "unauthorized" &&
              "You are not authorized to perform this action."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8">
        {/* QuickBooks App Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>QuickBooks Online App Configuration</CardTitle>
            <CardDescription>
              Configure your QuickBooks OAuth app credentials. These
              credentials are used for all QuickBooks integrations across the
              platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuickBooksAppConfigForm existingConfig={existingConfig} />
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle>How to Get QuickBooks Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Go to the{" "}
                <a
                  href="https://developer.intuit.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  QuickBooks Developer Portal
                </a>
              </li>
              <li>Sign in or create a developer account</li>
              <li>Click "Create an app" or select an existing app</li>
              <li>Go to "Keys & credentials" section</li>
              <li>
                Copy your <strong>Client ID</strong> and{" "}
                <strong>Client Secret</strong>
              </li>
              <li>
                Set the redirect URI to:{" "}
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  {process.env.NEXT_PUBLIC_APP_URL ||
                    "https://yourdomain.com"}
                  /api/quickbooks/callback
                </code>
              </li>
              <li>
                Select <strong>Sandbox</strong> for testing or{" "}
                <strong>Production</strong> for live data
              </li>
            </ol>

            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Security Note:</strong> The Client Secret is sensitive
                information. It will be stored securely and never displayed
                after saving.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
