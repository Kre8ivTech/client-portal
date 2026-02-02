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
} from "lucide-react";
import { CalendarIntegrations } from "@/components/integrations/calendar-integrations";
import { StripeSettingsForm } from "@/components/integrations/stripe-settings-form";
import { ZapierIntegration } from "@/components/integrations/zapier-integration";
import { getAppSettings } from "@/lib/actions/app-settings";

export default async function IntegrationsPage() {
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

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">Integrations</h2>
        <p className="text-muted-foreground mt-2">
          Connect external services to enable payments, AI features, email notifications, and calendar sync.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Stripe Integration */}
        <StripeSettingsForm initialSettings={appSettings} />

        {/* AI Providers */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Bot className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">AI Providers</CardTitle>
                  <CardDescription>Enable AI-powered features like chat assistance and content generation</CardDescription>
                </div>
              </div>
              <ConnectionStatus connected={anthropicConfigured || openaiConfigured || openrouterConfigured} />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Anthropic */}
            <div className="space-y-2 pb-4 border-b">
              <div className="flex items-center justify-between">
                <Label htmlFor="anthropic-key" className="flex items-center gap-2">
                  <span className="font-semibold">Anthropic (Claude)</span>
                  {anthropicConfigured && <Badge variant="secondary" className="text-xs">Connected</Badge>}
                </Label>
              </div>
              <div className="flex gap-2">
                <Input
                  id="anthropic-key"
                  type="password"
                  placeholder="sk-ant-..."
                  defaultValue={anthropicConfigured ? "••••••••••••••••" : ""}
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="sm" className="shrink-0">
                  {anthropicConfigured ? "Update" : "Save"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  Get API key <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            {/* OpenAI */}
            <div className="space-y-2 pb-4 border-b">
              <div className="flex items-center justify-between">
                <Label htmlFor="openai-key" className="flex items-center gap-2">
                  <span className="font-semibold">OpenAI (GPT)</span>
                  {openaiConfigured && <Badge variant="secondary" className="text-xs">Connected</Badge>}
                </Label>
              </div>
              <div className="flex gap-2">
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="sk-..."
                  defaultValue={openaiConfigured ? "••••••••••••••••" : ""}
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="sm" className="shrink-0">
                  {openaiConfigured ? "Update" : "Save"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  Get API key <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            {/* OpenRouter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="openrouter-key" className="flex items-center gap-2">
                  <span className="font-semibold">OpenRouter</span>
                  {openrouterConfigured && <Badge variant="secondary" className="text-xs">Connected</Badge>}
                </Label>
              </div>
              <div className="flex gap-2">
                <Input
                  id="openrouter-key"
                  type="password"
                  placeholder="sk-or-..."
                  defaultValue={openrouterConfigured ? "••••••••••••••••" : ""}
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="sm" className="shrink-0">
                  {openrouterConfigured ? "Update" : "Save"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  Get API key <ExternalLink className="w-3 h-3" />
                </a>
                {" "}- Access multiple AI models through one API
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                API keys are stored securely as environment variables or in application settings. Contact your system administrator for production updates.
              </p>
            </div>
          </CardContent>
        </Card>

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
        <div>
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Automation</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Connect with Zapier to automate workflows and integrate with thousands of apps
            </p>
          </div>
          <ZapierIntegration />
        </div>
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

