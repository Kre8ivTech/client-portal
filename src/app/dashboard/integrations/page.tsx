import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SmtpConfigForm } from "@/components/settings/smtp-config-form";

interface IntegrationsPageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

function oauthErrorMessage(code: string | undefined) {
  if (!code) return "Calendar connection failed.";
  const map: Record<string, string> = {
    missing_params: "OAuth callback missing parameters. Try connecting again.",
    invalid_state: "Invalid or tampered OAuth state. Try connecting again.",
    state_expired: "Connection timed out. Try connecting again.",
    unauthorized: "Session mismatch. Sign in and try again.",
    oauth_not_configured: "Server is missing Google or Microsoft OAuth credentials.",
    token_exchange_failed: "Could not exchange authorization code. Check client secret and redirect URI.",
    save_failed: "Could not save the connection. Try again or contact support.",
    oauth_failed: "OAuth failed unexpectedly.",
  };
  return map[code] ?? code;
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
  if (userRole?.role !== "super_admin" && userRole?.role !== "admin") {
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

  const { data: globalSmtpConfig } = await (supabase as any)
    .from("smtp_configurations")
    .select("id")
    .is("organization_id", null)
    .maybeSingle();

  const smtpConfigured = Boolean(globalSmtpConfig);

  const googleCalendarOAuthConfigured = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  const microsoftCalendarOAuthConfigured = !!(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  );

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
      {params.success === "google_connected" && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Google Calendar connected for this account.
          </AlertDescription>
        </Alert>
      )}
      {params.success === "microsoft_connected" && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Microsoft Outlook connected for this account.
          </AlertDescription>
        </Alert>
      )}
      {params.error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">{oauthErrorMessage(params.error)}</AlertDescription>
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
              <ConnectionStatus connected={smtpConfigured || resendConfigured} />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <SmtpConfigForm
              embedded
              endpoint="/api/admin/email/smtp"
              title="SMTP Provider"
              description="Use any SMTP provider (SES, SendGrid SMTP, Mailgun SMTP, Postmark SMTP, etc.)."
            />

            {smtpConfigured ? (
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-800">Custom SMTP is configured and active</p>
                  <p className="text-xs text-green-700">
                    Outbound notifications now use your configured SMTP provider as the primary email channel.
                  </p>
                </div>
              </div>
            ) : resendConfigured ? (
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-800">Resend is configured and active</p>
                  <p className="text-xs text-green-700">
                    The <code className="bg-green-100 px-1 py-0.5 rounded text-xs">RESEND_API_KEY</code> environment variable is set.
                    Email notifications and invoices will be sent via Resend.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-800">Resend is not configured</p>
                  <p className="text-xs text-amber-700">
                    To enable email notifications, set the following environment variables in your deployment:
                  </p>
                  <div className="bg-amber-100/50 rounded p-2 text-xs font-mono text-amber-900 space-y-1">
                    <div>RESEND_API_KEY=re_...</div>
                    <div>EMAIL_FROM=noreply@yourdomain.com</div>
                  </div>
                  <p className="text-xs text-amber-700">
                    <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-amber-800 font-medium hover:underline inline-flex items-center gap-1">
                      Get your API key from Resend <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
              </div>
            )}
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
            <CalendarIntegrations
              integrations={calendarIntegrations || []}
              oauthReturnPath="/dashboard/integrations"
              googleOAuthConfigured={googleCalendarOAuthConfigured}
              microsoftOAuthConfigured={microsoftCalendarOAuthConfigured}
            />
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
