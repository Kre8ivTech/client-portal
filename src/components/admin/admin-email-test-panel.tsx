"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail } from "lucide-react";

type Props = {
  defaultEmail: string;
  organizationId: string | null;
};

export function AdminEmailTestPanel({ defaultEmail, organizationId }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ provider?: string; messageId?: string } | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          organization_id: organizationId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send test email");
      }
      setResult({
        provider: data.provider,
        messageId: data.messageId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-5 w-5" />
          Test email delivery
        </CardTitle>
        <CardDescription>
          Sends a short test message through the same path as notifications (organization SMTP if configured,
          otherwise Resend). Requires <code className="text-xs">RESEND_API_KEY</code> or SMTP settings in admin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-test-email">Recipient</Label>
            <Input
              id="admin-test-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {result && (
            <Alert>
              <AlertDescription>
                Sent via {result.provider ?? "unknown"}
                {result.messageId ? (
                  <>
                    {" "}
                    (id: <span className="font-mono text-xs">{result.messageId}</span>)
                  </>
                ) : null}
                .
              </AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send test email
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
