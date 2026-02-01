import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Bot,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { CalendarIntegrations } from "@/components/integrations/calendar-integrations";

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

  // Fetch user's calendar integrations
  const { data: calendarIntegrations } = await supabase
    .from("oauth_integrations")
    .select("id, provider, provider_email, status")
    .eq("user_id", user.id)
    .in("provider", ["google_calendar", "microsoft_outlook", "apple_caldav"]);

  // Check which integrations are configured (via env vars on server)
  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
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
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#635BFF]/10 rounded-lg">
                  <CreditCard className="w-5 h-5 text-[#635BFF]" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Stripe</CardTitle>
                  <CardDescription>Payment processing and invoicing</CardDescription>
                </div>
              </div>
              <ConnectionStatus connected={stripeConfigured} />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stripe-secret">Secret Key</Label>
              <div className="flex gap-2">
                <Input
                  id="stripe-secret"
                  type="password"
                  placeholder="sk_live_..."
                  defaultValue={stripeConfigured ? "••••••••••••••••" : ""}
                  className="font-mono text-sm"
                  readOnly={stripeConfigured}
                />
                <Button variant="outline" size="sm" className="shrink-0">
                  {stripeConfigured ? "Update" : "Save"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your API keys from the{" "}
                <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  Stripe Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripe-webhook">Webhook Secret</Label>
              <div className="flex gap-2">
                <Input
                  id="stripe-webhook"
                  type="password"
                  placeholder="whsec_..."
                  className="font-mono text-sm"
                  readOnly
                />
                <Button variant="outline" size="sm" className="shrink-0">
                  Update
                </Button>
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="font-medium mb-1">Webhook Endpoint</p>
              <code className="text-xs text-muted-foreground">
                {process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/stripe
              </code>
            </div>
          </CardContent>
        </Card>

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
                API keys are stored securely as environment variables. Contact your system administrator to update production keys.
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
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm">
                Send Test Email
              </Button>
              <Button variant="outline" size="sm">
                View Email Templates
              </Button>
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
