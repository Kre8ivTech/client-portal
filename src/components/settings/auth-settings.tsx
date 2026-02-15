"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Key, Loader2, Save, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuthSettingsData {
  sso_google_enabled: boolean;
  sso_microsoft_enabled: boolean;
  sso_github_enabled: boolean;
  sso_apple_enabled: boolean;
  recaptcha_enabled: boolean;
  recaptcha_site_key: string;
  recaptcha_secret_configured: boolean;
  mfa_enabled: boolean;
  mfa_required_for_staff: boolean;
  mfa_required_for_clients: boolean;
}

export function AuthSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AuthSettingsData>({
    sso_google_enabled: false,
    sso_microsoft_enabled: false,
    sso_github_enabled: false,
    sso_apple_enabled: false,
    recaptcha_enabled: false,
    recaptcha_site_key: "",
    recaptcha_secret_configured: false,
    mfa_enabled: true,
    mfa_required_for_staff: false,
    mfa_required_for_clients: false,
  });
  const [newRecaptchaSecret, setNewRecaptchaSecret] = useState("");

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/admin/auth/settings", { method: "GET" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load auth settings");
      }

      setSettings(payload.settings as AuthSettingsData);
    } catch (err) {
      console.error("Failed to load auth settings:", err);
      toast({
        title: "Error",
        description: "Failed to load authentication settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (settings.recaptcha_enabled && !settings.recaptcha_site_key.trim()) {
      toast({
        title: "Validation error",
        description: "reCAPTCHA site key is required when reCAPTCHA is enabled",
        variant: "destructive",
      });
      return;
    }

    if (
      settings.recaptcha_enabled &&
      !settings.recaptcha_secret_configured &&
      newRecaptchaSecret.trim().length === 0
    ) {
      toast({
        title: "Validation error",
        description: "Set a reCAPTCHA secret key before enabling reCAPTCHA",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/auth/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sso_google_enabled: settings.sso_google_enabled,
          sso_microsoft_enabled: settings.sso_microsoft_enabled,
          sso_github_enabled: settings.sso_github_enabled,
          sso_apple_enabled: settings.sso_apple_enabled,
          recaptcha_enabled: settings.recaptcha_enabled,
          recaptcha_site_key: settings.recaptcha_site_key || null,
          recaptcha_secret_key: newRecaptchaSecret.trim() || undefined,
          mfa_enabled: settings.mfa_enabled,
          mfa_required_for_staff: settings.mfa_required_for_staff,
          mfa_required_for_clients: settings.mfa_required_for_clients,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save settings");
      }

      toast({
        title: "Success",
        description: "Authentication settings updated successfully",
      });

      if (newRecaptchaSecret.trim().length > 0) {
        setSettings((prev) => ({ ...prev, recaptcha_secret_configured: true }));
        setNewRecaptchaSecret("");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof AuthSettingsData>(key: K, value: AuthSettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* SSO Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Single Sign-On (SSO)
          </CardTitle>
          <CardDescription>
            Enable social login providers for easier authentication. SSO providers must be configured in your{" "}
            <a
              href="https://supabase.com/dashboard/project/_/auth/providers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Supabase Dashboard
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              SSO providers must be configured in Supabase before enabling them here. Enable the provider in Supabase
              Dashboard &gt; Authentication &gt; Providers.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                </div>
                <div>
                  <Label className="text-base">Google</Label>
                  <p className="text-sm text-muted-foreground">Sign in with Google account</p>
                </div>
              </div>
              <Switch
                checked={settings.sso_google_enabled}
                onCheckedChange={(v) => updateSetting("sso_google_enabled", v)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center">
                  <svg className="h-5 w-5" viewBox="0 0 21 21">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                </div>
                <div>
                  <Label className="text-base">Microsoft</Label>
                  <p className="text-sm text-muted-foreground">Sign in with Microsoft account</p>
                </div>
              </div>
              <Switch
                checked={settings.sso_microsoft_enabled}
                onCheckedChange={(v) => updateSetting("sso_microsoft_enabled", v)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                  <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <Label className="text-base">GitHub</Label>
                  <p className="text-sm text-muted-foreground">Sign in with GitHub account</p>
                </div>
              </div>
              <Switch
                checked={settings.sso_github_enabled}
                onCheckedChange={(v) => updateSetting("sso_github_enabled", v)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
                  <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                </div>
                <div>
                  <Label className="text-base">Apple</Label>
                  <p className="text-sm text-muted-foreground">Sign in with Apple ID</p>
                </div>
              </div>
              <Switch
                checked={settings.sso_apple_enabled}
                onCheckedChange={(v) => updateSetting("sso_apple_enabled", v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MFA Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Two-Factor Authentication (MFA)
          </CardTitle>
          <CardDescription>Configure multi-factor authentication requirements for your organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="text-base">Enable MFA</Label>
              <p className="text-sm text-muted-foreground">Allow users to set up two-factor authentication</p>
            </div>
            <Switch checked={settings.mfa_enabled} onCheckedChange={(v) => updateSetting("mfa_enabled", v)} />
          </div>

          <Separator />

          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="text-base">Require MFA for Staff</Label>
              <p className="text-sm text-muted-foreground">Force all staff and admin users to enable MFA</p>
            </div>
            <Switch
              checked={settings.mfa_required_for_staff}
              onCheckedChange={(v) => updateSetting("mfa_required_for_staff", v)}
              disabled={!settings.mfa_enabled}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="text-base">Require MFA for Clients</Label>
              <p className="text-sm text-muted-foreground">Force all client users to enable MFA</p>
            </div>
            <Switch
              checked={settings.mfa_required_for_clients}
              onCheckedChange={(v) => updateSetting("mfa_required_for_clients", v)}
              disabled={!settings.mfa_enabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* reCAPTCHA Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            reCAPTCHA Protection
          </CardTitle>
          <CardDescription>
            Protect your login and signup forms from bots using Google reCAPTCHA v3. Get your keys from the{" "}
            <a
              href="https://www.google.com/recaptcha/admin"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Google reCAPTCHA Admin Console
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="text-base">Enable reCAPTCHA</Label>
              <p className="text-sm text-muted-foreground">Protect login and signup forms</p>
            </div>
            <Switch
              checked={settings.recaptcha_enabled}
              onCheckedChange={(v) => updateSetting("recaptcha_enabled", v)}
            />
          </div>

          {settings.recaptcha_enabled && (
            <>
              <Separator />

              <div className="space-y-2">
                <Label>Site Key (Public)</Label>
                <Input
                  placeholder="6LcXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  value={settings.recaptcha_site_key}
                  onChange={(e) => updateSetting("recaptcha_site_key", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This key is used in the frontend and is visible to users.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Secret Key (Private)</Label>
                <Input
                  type="password"
                  placeholder="6LcXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                value={newRecaptchaSecret}
                onChange={(e) => setNewRecaptchaSecret(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This key is used server-side to verify tokens. Leave blank to keep the current secret.
                </p>
              </div>

              {(settings.recaptcha_secret_configured || newRecaptchaSecret.trim().length > 0) && (
                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 dark:text-blue-300">
                    Secret key {settings.recaptcha_secret_configured ? "is configured" : "will be configured on save"}.
                  </AlertDescription>
                </Alert>
              )}

              {settings.recaptcha_site_key && (settings.recaptcha_secret_configured || newRecaptchaSecret.trim().length > 0) && (
                <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-300">
                    reCAPTCHA is configured and will protect your login form.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Authentication Settings
        </Button>
      </div>
    </div>
  );
}
