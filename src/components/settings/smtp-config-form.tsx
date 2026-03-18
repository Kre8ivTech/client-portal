"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, CheckCircle2, AlertCircle } from "lucide-react";

const MASKED_SECRET = "****************";

type SmtpConfig = {
  id: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
};

type SmtpConfigFormProps = {
  endpoint: string;
  title?: string;
  description?: string;
  disabled?: boolean;
};

export function SmtpConfigForm({
  endpoint,
  title = "SMTP Email Provider",
  description = "Configure custom SMTP settings.",
  disabled = false,
}: SmtpConfigFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [config, setConfig] = useState<SmtpConfig | null>(null);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadConfig() {
      setLoading(true);
      setMessage(null);
      try {
        const response = await fetch(endpoint, { method: "GET" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load SMTP configuration");
        }

        if (!mounted) return;
        const existing = (data.config as SmtpConfig | null) ?? null;
        setConfig(existing);
        setHost(existing?.host || "");
        setPort(existing?.port || 587);
        setSecure(Boolean(existing?.secure));
        setUsername(existing?.username || "");
        setPassword(existing ? MASKED_SECRET : "");
        setFromName(existing?.from_name || "");
        setFromEmail(existing?.from_email || "");
        setReplyTo(existing?.reply_to || "");
      } catch (error) {
        if (!mounted) return;
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to load SMTP configuration",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadConfig();
    return () => {
      mounted = false;
    };
  }, [endpoint]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port,
          secure,
          username,
          password,
          from_name: fromName || null,
          from_email: fromEmail || null,
          reply_to: replyTo || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save SMTP configuration");
      }

      setMessage({ type: "success", text: "SMTP configuration saved." });
      setConfig((prev) =>
        prev
          ? { ...prev, host, port, secure, username, from_name: fromName || null, from_email: fromEmail || null, reply_to: replyTo || null }
          : {
              id: "configured",
              host,
              port,
              secure,
              username,
              from_name: fromName || null,
              from_email: fromEmail || null,
              reply_to: replyTo || null,
            },
      );
      setPassword(MASKED_SECRET);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save SMTP configuration",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (disabled) return;

    setDeleting(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete SMTP configuration");
      }

      setConfig(null);
      setHost("");
      setPort(587);
      setSecure(false);
      setUsername("");
      setPassword("");
      setFromName("");
      setFromEmail("");
      setReplyTo("");
      setMessage({ type: "success", text: "SMTP configuration removed." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to delete SMTP configuration",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Mail className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading SMTP configuration...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp-host">SMTP Host</Label>
                <Input id="smtp-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.yourprovider.com" disabled={disabled || saving} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">Port</Label>
                <Input id="smtp-port" type="number" min={1} max={65535} value={port} onChange={(e) => setPort(Number(e.target.value) || 587)} disabled={disabled || saving} required />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp-username">Username</Label>
                <Input id="smtp-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="smtp-user" disabled={disabled || saving} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-password">Password</Label>
                <Input
                  id="smtp-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={config ? "Leave unchanged or enter new password" : "SMTP password"}
                  disabled={disabled || saving}
                  required={!config}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp-from-name">From Name (optional)</Label>
                <Input id="smtp-from-name" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your Support Team" disabled={disabled || saving} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-from-email">From Email (optional)</Label>
                <Input id="smtp-from-email" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="support@yourdomain.com" disabled={disabled || saving} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-reply-to">Reply-To (optional)</Label>
              <Input id="smtp-reply-to" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="help@yourdomain.com" disabled={disabled || saving} />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Use TLS/SSL</p>
                <p className="text-xs text-muted-foreground">Enable for SMTPS (typically port 465). Disable for STARTTLS (usually port 587).</p>
              </div>
              <Switch checked={secure} onCheckedChange={setSecure} disabled={disabled || saving} />
            </div>

            {message && (
              <Alert variant={message.type === "error" ? "destructive" : "default"}>
                {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={disabled || saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {config ? "Update SMTP" : "Save SMTP"}
              </Button>

              {config && (
                <Button type="button" variant="outline" onClick={handleDelete} disabled={disabled || deleting}>
                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Remove SMTP
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
