"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Palette, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { updatePortalBranding } from "@/lib/actions/portal-branding";

type Branding = {
  app_name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  favicon_url: string | null;
};

function hslToCss(hsl: string): string {
  if (hsl.startsWith("#")) return hsl;
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return "hsl(231, 48%, 58%)";
  return `hsl(${parts[1]}, ${parts[2]}%, ${parts[3]}%)`;
}

export function PortalBrandingForm({ branding }: { branding: Branding }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await updatePortalBranding(formData);
    setLoading(false);
    if (result.success) {
      setMessage({ type: "success", text: "Branding updated. Changes apply across the portal and login page." });
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to update branding." });
    }
  }

  const primaryCss = hslToCss(branding.primary_color);

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 border-b">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Palette className="text-primary w-5 h-5" />
          Portal Branding & Styling
        </CardTitle>
        <CardDescription>
          Portal-wide logo, name, and primary color. Applies to the login page and dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="app_name">App name</Label>
                <Input
                  id="app_name"
                  name="app_name"
                  defaultValue={branding.app_name}
                  placeholder="KT-Portal"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  name="tagline"
                  defaultValue={branding.tagline ?? ""}
                  placeholder="Client Portal"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary color (HSL or hex)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="primary_color"
                    name="primary_color"
                    defaultValue={
                      branding.primary_color.startsWith("#")
                        ? branding.primary_color
                        : branding.primary_color
                    }
                    placeholder="231 48% 58% or #556ee6"
                    className="bg-background flex-1"
                  />
                  <div
                    className="h-10 w-10 shrink-0 rounded-md border border-border"
                    style={{ backgroundColor: primaryCss }}
                    title="Preview"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input
                  id="logo_url"
                  name="logo_url"
                  type="url"
                  defaultValue={branding.logo_url ?? ""}
                  placeholder="https://..."
                  className="bg-background"
                />
                {branding.logo_url && (
                  <div className="mt-2 h-16 flex items-center">
                    <img
                      src={branding.logo_url}
                      alt="Logo preview"
                      className="max-h-12 max-w-[120px] object-contain"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="favicon_url">Favicon URL</Label>
                <Input
                  id="favicon_url"
                  name="favicon_url"
                  type="url"
                  defaultValue={branding.favicon_url ?? ""}
                  placeholder="https://..."
                  className="bg-background"
                />
              </div>
            </div>
          </div>
          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              {message.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Update branding"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
