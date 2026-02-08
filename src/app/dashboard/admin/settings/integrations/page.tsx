import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QuickBooksAppConfigForm } from "@/components/admin/quickbooks-app-config-form";
import { S3ConfigForm } from "@/components/admin/s3-config-form";
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

  const APP_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
  const db = supabase as unknown as { from: (table: string) => any };

  const { data: appSettingsRow } = await db
    .from("app_settings")
    .select("aws_s3_config_encrypted")
    .eq("id", APP_SETTINGS_ID)
    .single();

  const hasEncryptedS3 = !!appSettingsRow?.aws_s3_config_encrypted;

  const { data: s3Config } = await db
    .from("aws_s3_config")
    .select(
      "id, aws_region, access_key_id, bucket_name, kms_key_id, created_at, updated_at"
    )
    .is("organization_id", null)
    .maybeSingle();

  const s3EnvConfigured =
    !!process.env.AWS_S3_BUCKET_NAME &&
    !!process.env.AWS_ACCESS_KEY_ID &&
    !!process.env.AWS_SECRET_ACCESS_KEY;

  const s3ExistingConfig = hasEncryptedS3
    ? {
        id: "encrypted",
        aws_region: "us-east-1",
        access_key_id_masked: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
        bucket_name: "(encrypted)",
        kms_key_id: null,
        created_at: "",
        updated_at: "",
      }
    : s3Config
      ? {
          ...s3Config,
          access_key_id_masked: maskKey(s3Config.access_key_id || ""),
        }
      : null;

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
            {params.success === "s3_config_saved" &&
              "AWS S3 configuration saved successfully!"}
            {params.success === "s3_config_deleted" &&
              "AWS S3 configuration deleted successfully!"}
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

        {/* AWS S3 Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>AWS S3 File Storage</CardTitle>
            <CardDescription>
              Configure AWS S3 credentials for encrypted file storage. All
              client files are stored with server-side encryption (AES-256 or
              KMS).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <S3ConfigForm
              existingConfig={s3ExistingConfig}
              envConfigured={s3EnvConfigured}
            />
          </CardContent>
        </Card>

        {/* S3 Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Set Up AWS S3</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Create an S3 bucket in the{" "}
                <a
                  href="https://console.aws.amazon.com/s3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  AWS Console
                </a>
              </li>
              <li>
                Enable <strong>Default Encryption</strong> (SSE-S3 or SSE-KMS)
                on the bucket
              </li>
              <li>
                Block all public access (bucket should be{" "}
                <strong>private</strong>)
              </li>
              <li>
                Create an IAM user with{" "}
                <strong>s3:PutObject, s3:GetObject, s3:DeleteObject, s3:ListBucket</strong>{" "}
                permissions on the bucket
              </li>
              <li>
                Generate an <strong>Access Key</strong> for the IAM user
              </li>
              <li>Enter the credentials above</li>
            </ol>

            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Security Note:</strong> Use a dedicated IAM user with
                minimal permissions. Never use root account credentials. The
                Secret Access Key is stored securely and never displayed after
                saving.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}
