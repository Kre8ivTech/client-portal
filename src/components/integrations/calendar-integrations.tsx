"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2, ExternalLink } from "lucide-react";

type Integration = {
  id: string;
  provider: string;
  provider_email: string | null;
  status: string;
};

type CalendarIntegrationsProps = {
  integrations: Integration[];
};

export function CalendarIntegrations({ integrations }: CalendarIntegrationsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleModalOpen, setAppleModalOpen] = useState(false);
  const [appleEmail, setAppleEmail] = useState("");
  const [applePassword, setApplePassword] = useState("");
  const [localIntegrations, setLocalIntegrations] = useState(integrations);

  const googleIntegration = localIntegrations.find(i => i.provider === "google_calendar");
  const microsoftIntegration = localIntegrations.find(i => i.provider === "microsoft_outlook");
  const appleIntegration = localIntegrations.find(i => i.provider === "apple_caldav");

  const handleGoogleConnect = async () => {
    setLoading("google");
    setError(null);
    try {
      const response = await fetch("/api/integrations/google");
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setError("Failed to initiate Google connection");
    } finally {
      setLoading(null);
    }
  };

  const handleMicrosoftConnect = async () => {
    setLoading("microsoft");
    setError(null);
    try {
      const response = await fetch("/api/integrations/microsoft");
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setError("Failed to initiate Microsoft connection");
    } finally {
      setLoading(null);
    }
  };

  const handleAppleConnect = async () => {
    if (!appleEmail || !applePassword) {
      setError("Please enter both email and app-specific password");
      return;
    }

    setLoading("apple");
    setError(null);
    try {
      const response = await fetch("/api/integrations/apple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: appleEmail, appPassword: applePassword }),
      });
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.success) {
        setAppleModalOpen(false);
        setAppleEmail("");
        setApplePassword("");
        // Update local state
        setLocalIntegrations(prev => [
          ...prev.filter(i => i.provider !== "apple_caldav"),
          { id: "new", provider: "apple_caldav", provider_email: appleEmail, status: "active" }
        ]);
      }
    } catch (err) {
      setError("Failed to connect Apple Calendar");
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    const providerMap: Record<string, string> = {
      google_calendar: "google",
      microsoft_outlook: "microsoft",
      apple_caldav: "apple",
    };
    const apiProvider = providerMap[provider] || provider;

    setLoading(provider);
    setError(null);
    try {
      const response = await fetch(`/api/integrations/${apiProvider}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.success) {
        setLocalIntegrations(prev => prev.filter(i => i.provider !== provider));
      }
    } catch (err) {
      setError("Failed to disconnect");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

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
            {googleIntegration ? (
              <p className="text-xs text-muted-foreground">{googleIntegration.provider_email}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sync with Google Workspace</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {googleIntegration && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          )}
          {googleIntegration ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDisconnect("google_calendar")}
              disabled={loading === "google_calendar"}
            >
              {loading === "google_calendar" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Disconnect
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoogleConnect}
              disabled={loading === "google"}
            >
              {loading === "google" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Connect
            </Button>
          )}
        </div>
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
            {microsoftIntegration ? (
              <p className="text-xs text-muted-foreground">{microsoftIntegration.provider_email}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sync with Microsoft 365</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {microsoftIntegration && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          )}
          {microsoftIntegration ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDisconnect("microsoft_outlook")}
              disabled={loading === "microsoft_outlook"}
            >
              {loading === "microsoft_outlook" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Disconnect
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMicrosoftConnect}
              disabled={loading === "microsoft"}
            >
              {loading === "microsoft" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Connect
            </Button>
          )}
        </div>
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
            {appleIntegration ? (
              <p className="text-xs text-muted-foreground">{appleIntegration.provider_email}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sync via CalDAV</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {appleIntegration && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          )}
          {appleIntegration ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDisconnect("apple_caldav")}
              disabled={loading === "apple_caldav"}
            >
              {loading === "apple_caldav" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Disconnect
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAppleModalOpen(true)}
              disabled={loading === "apple"}
            >
              {loading === "apple" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Connect
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground pt-2">
        Calendar integrations allow staff to sync their availability and automatically block time for client appointments.
      </p>

      {/* Apple CalDAV Modal */}
      <Dialog open={appleModalOpen} onOpenChange={setAppleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Apple Calendar</DialogTitle>
            <DialogDescription>
              Apple Calendar uses CalDAV which requires an app-specific password for security.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apple-email">Apple ID Email</Label>
              <Input
                id="apple-email"
                type="email"
                placeholder="your@icloud.com"
                value={appleEmail}
                onChange={(e) => setAppleEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apple-password">App-Specific Password</Label>
              <Input
                id="apple-password"
                type="password"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                value={applePassword}
                onChange={(e) => setApplePassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Generate an app-specific password at{" "}
                <a
                  href="https://appleid.apple.com/account/manage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  appleid.apple.com <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppleModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAppleConnect} disabled={loading === "apple"}>
              {loading === "apple" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
