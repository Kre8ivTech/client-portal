"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CreditCard, ExternalLink, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { updateStripeSettings, AppSettings } from "@/lib/actions/app-settings";
import { toast } from "sonner";

interface StripeSettingsFormProps {
  initialSettings: AppSettings;
}

export function StripeSettingsForm({ initialSettings }: StripeSettingsFormProps) {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);

  const handleToggleMode = async (checked: boolean) => {
    const newMode = checked ? "live" : "test";
    setSettings((prev) => ({ ...prev, stripe_mode: newMode }));
    
    setLoading(true);
    try {
      const result = await updateStripeSettings({ stripe_mode: newMode });
      if (result.success) {
        toast.success(`Stripe mode switched to ${newMode}`);
      } else {
        toast.error(result.error || "Failed to update mode");
        setSettings((prev) => ({ ...prev, stripe_mode: initialSettings.stripe_mode }));
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateKey = async (key: keyof AppSettings, value: string) => {
    setLoading(true);
    try {
      const result = await updateStripeSettings({ [key]: value || null });
      if (result.success) {
        toast.success("Stripe key updated");
        setSettings((prev) => ({ ...prev, [key]: value }));
      } else {
        toast.error(result.error || "Failed to update key");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = settings.stripe_mode === 'live' 
    ? !!settings.stripe_live_secret_key 
    : !!settings.stripe_test_secret_key;

  return (
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="stripe-mode" className="text-sm font-medium">
                {settings.stripe_mode === 'live' ? 'Live Mode' : 'Test Mode'}
              </Label>
              <Switch
                id="stripe-mode"
                checked={settings.stripe_mode === "live"}
                onCheckedChange={handleToggleMode}
                disabled={loading}
              />
            </div>
            <ConnectionStatus connected={isConfigured} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Test Keys Section */}
        <div className={`space-y-4 p-4 rounded-lg border ${settings.stripe_mode === 'test' ? 'bg-amber-50/50 border-amber-200' : 'bg-muted/30 border-transparent opacity-60'}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Test Environment
              {settings.stripe_mode === 'test' && <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 uppercase">Active</Badge>}
            </h3>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="stripe-test-secret">Test Secret Key</Label>
              <div className="flex gap-2">
                <Input
                  id="stripe-test-secret"
                  type="password"
                  placeholder="sk_test_..."
                  defaultValue={settings.stripe_test_secret_key || ""}
                  className="font-mono text-sm bg-background"
                  onBlur={(e) => {
                    if (e.target.value !== settings.stripe_test_secret_key) {
                      handleUpdateKey('stripe_test_secret_key', e.target.value);
                    }
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripe-test-webhook">Test Webhook Secret</Label>
              <div className="flex gap-2">
                <Input
                  id="stripe-test-webhook"
                  type="password"
                  placeholder="whsec_..."
                  defaultValue={settings.stripe_test_webhook_secret || ""}
                  className="font-mono text-sm bg-background"
                  onBlur={(e) => {
                    if (e.target.value !== settings.stripe_test_webhook_secret) {
                      handleUpdateKey('stripe_test_webhook_secret', e.target.value);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Keys Section */}
        <div className={`space-y-4 p-4 rounded-lg border ${settings.stripe_mode === 'live' ? 'bg-green-50/50 border-green-200' : 'bg-muted/30 border-transparent opacity-60'}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Live Environment
              {settings.stripe_mode === 'live' && <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 border-green-200 uppercase">Active</Badge>}
            </h3>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="stripe-live-secret">Live Secret Key</Label>
              <div className="flex gap-2">
                <Input
                  id="stripe-live-secret"
                  type="password"
                  placeholder="sk_live_..."
                  defaultValue={settings.stripe_live_secret_key || ""}
                  className="font-mono text-sm bg-background"
                  onBlur={(e) => {
                    if (e.target.value !== settings.stripe_live_secret_key) {
                      handleUpdateKey('stripe_live_secret_key', e.target.value);
                    }
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripe-live-webhook">Live Webhook Secret</Label>
              <div className="flex gap-2">
                <Input
                  id="stripe-live-webhook"
                  type="password"
                  placeholder="whsec_..."
                  defaultValue={settings.stripe_live_webhook_secret || ""}
                  className="font-mono text-sm bg-background"
                  onBlur={(e) => {
                    if (e.target.value !== settings.stripe_live_webhook_secret) {
                      handleUpdateKey('stripe_live_webhook_secret', e.target.value);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          <p className="font-medium mb-1">Webhook Endpoint</p>
          <div className="flex items-center justify-between">
            <code className="text-xs text-muted-foreground break-all">
              {process.env.NEXT_PUBLIC_APP_URL || 'https://your-portal.com'}/api/webhooks/stripe
            </code>
            <a 
              href="https://dashboard.stripe.com/apikeys" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary hover:underline inline-flex items-center gap-1 text-xs shrink-0 ml-2"
            >
              Stripe Dashboard <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving changes...
          </div>
        )}
      </CardContent>
    </Card>
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
      Not Configured
    </Badge>
  );
}
