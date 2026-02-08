import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertCircle,
  HardDrive,
} from "lucide-react";
import { CalendarIntegrations } from "@/components/integrations/calendar-integrations";
import { StripeSettingsForm } from "@/components/integrations/stripe-settings-form";
import { AIProvidersForm } from "@/components/integrations/ai-providers-form";
import { ZapierIntegration } from "@/components/integrations/zapier-integration";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { S3ConfigForm } from "@/components/admin/s3-config-form";
import { getAppSettings } from "@/lib/actions/app-settings";

interface IntegrationsPageProps {
  searchParams: Promise<{ success?: string }>;
}

export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check user role - only super_admin can access
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = userData as { role: string } | null;
  if (userRole?.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Fetch settings
  const appSettings = await getAppSettings();

  // Fetch user's calendar integrations
  const { data: calendarIntegrations } = await supabase
    .from("oauth_integrations")
    .select("id, provider, provider_email, status")
    .eq("user_id", user.id)
    .in("provider", ["google_calendar", "microsoft_outlook", "apple_caldav"]);

  // Check which integrations are configured (via env vars on server)
  const resendConfigured = !!process.env.RESEND_API_KEY;
  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;
  const openaiConfigured = !!process.env.OPENAI_API_KEY;
  const openrouterConfigured = !!process.env.OPENROUTER_API_KEY;

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
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">Integrations</h2>
        <p className="text-muted-foreground mt-2">
          Connect external services to enable payments, AI features, email notifications, and calendar sync.
        </p>
      </div>

      {params.success === "s3_config_saved" && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            AWS S3 configuration saved successfully.
          </AlertDescription>
        </Alert>
      )}
      {params.success === "s3_config_deleted" && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            AWS S3 configuration removed. Using environment variables if set.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Stripe Integration */}
        <StripeSettingsForm initialSettings={appSettings} />

        {/* AWS S3 Storage */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <HardDrive className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">AWS S3 File Storage</CardTitle>
                <CardDescription>
                  Configure S3 for contracts, file sync, and avatars. Credentials are stored encrypted.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <S3ConfigForm
              existingConfig={s3ExistingConfig}
              envConfigured={s3EnvConfigured}
              successRedirectBase="/dashboard/integrations"
            />
          </CardContent>
        </Card>

        {/* AI Providers */}
        <AIProvidersForm
          initialSettings={{
            ai_provider_primary: appSettings.ai_provider_primary,
            openrouter_api_key: appSettings.openrouter_api_key,
            anthropic_api_key: appSettings.anthropic_api_key,
            openai_api_key: appSettings.openai_api_key,
            gemini_api_key: appSettings.gemini_api_key,
          }}
        />

        {/* Email Integration */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Mail className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Email (Resend)</CardTitle>
                  <CardDescription>Transactional email for notifications and invoices</CardDescription>
                </div>
              </div>
              <ConnectionStatus connected={resendConfigured} />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resend-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="resend-key"
                  type="password"
                  placeholder="re_..."
                  defaultValue={resendConfigured ? "••••••••••••••••" : ""}
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="sm" className="shrink-0">
                  {resendConfigured ? "Update" : "Save"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  Get API key from Resend <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-from">From Address</Label>
              <Input
                id="email-from"
                type="email"
                placeholder="noreply@yourdomain.com"
                defaultValue={process.env.EMAIL_FROM || ""}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Must be a verified domain in your Resend account
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Integration */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Calendar Integrations</CardTitle>
                  <CardDescription>Sync appointments and availability with external calendars</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <CalendarIntegrations integrations={calendarIntegrations || []} />
          </CardContent>
        </Card>

        {/* Zapier Integration */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Bot className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Automation</CardTitle>
                <CardDescription>Connect with Zapier to automate workflows and integrate with thousands of apps</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ZapierIntegration />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ConnectionStatus({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      Connected
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-muted text-muted-foreground">
      <XCircle className="w-3 h-3 mr-1" />
      Not Connected
    </Badge>
  );
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

