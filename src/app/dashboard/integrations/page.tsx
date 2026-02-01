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
  Key,
  AlertCircle,
} from "lucide-react";

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
          <CardContent className="pt-6 space-y-4">
            {/* Google Calendar */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white border rounded-lg flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Google Calendar</p>
                  <p className="text-xs text-muted-foreground">Sync with Google Workspace</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Connect
              </Button>
            </div>

            {/* Microsoft Outlook */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white border rounded-lg flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6">
                    <path fill="#0078D4" d="M21.17 2.06H2.83c-.93 0-1.68.75-1.68 1.68v16.52c0 .93.75 1.68 1.68 1.68h18.34c.93 0 1.68-.75 1.68-1.68V3.74c0-.93-.75-1.68-1.68-1.68zm-9.3 15.38c0 .29-.23.52-.52.52H4.13c-.29 0-.52-.23-.52-.52V6.56c0-.29.23-.52.52-.52h7.22c.29 0 .52.23.52.52v10.88zm8.61-8.04l-7.09 4.37v-8.8l7.09 4.43z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Microsoft Outlook</p>
                  <p className="text-xs text-muted-foreground">Sync with Microsoft 365</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Connect
              </Button>
            </div>

            {/* Apple Calendar */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white border rounded-lg flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6">
                    <path fill="#000" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Apple Calendar</p>
                  <p className="text-xs text-muted-foreground">Sync via CalDAV</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Connect
              </Button>
            </div>

            <p className="text-xs text-muted-foreground pt-2">
              Calendar integrations allow staff to sync their availability and automatically block time for client appointments.
            </p>
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
