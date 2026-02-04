"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, ArrowRight, Loader2, Mail, Lock } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { cn } from "@/lib/utils";
import { getPortalBranding } from "@/lib/actions/portal-branding";
import { getAuthSettings, verifyRecaptcha, type AuthSettings } from "@/lib/actions/auth-settings";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { SSOButtons } from "@/components/auth/sso-buttons";
import { MFAVerify } from "@/components/auth/mfa-verify";

type LoginBranding = {
  app_name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  favicon_url: string | null;
  login_bg_color: string | null;
  login_bg_image_url: string | null;
  login_bg_overlay_opacity: number;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [branding, setBranding] = useState<LoginBranding | null>(null);
  const [authSettings, setAuthSettings] = useState<AuthSettings | null>(null);
  const [showMFA, setShowMFA] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    Promise.all([getPortalBranding(), getAuthSettings()]).then(([brandingData, authSettingsData]) => {
      setBranding(brandingData);
      setAuthSettings(authSettingsData);
    });
  }, []);

  // Password reset links sometimes land on /?code=... when Supabase Site URL has no path. Send to callback then /reset-password.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("code")) {
      window.location.href = `/auth/callback${window.location.search}`;
    }
  }, []);

  // Show message when redirected with auth_callback_failed (e.g. callback URL not in Supabase Redirect URLs)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth_callback_failed") {
      setMessage({
        type: "error",
        text: "Authentication failed. Please ensure the callback URL is configured correctly.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Execute reCAPTCHA when ready
  const executeRecaptcha = async (): Promise<string | null> => {
    if (!authSettings?.recaptcha_enabled || !authSettings?.recaptcha_site_key) {
      return null;
    }

    try {
      if (typeof window !== "undefined" && window.grecaptcha) {
        const token = await window.grecaptcha.execute(authSettings.recaptcha_site_key, { action: "login" });
        return token;
      }
    } catch (err) {
      console.error("reCAPTCHA error:", err);
    }
    return null;
  };

  const appName = branding?.app_name ?? "KT-Portal";
  const tagline = branding?.tagline ?? "Client Portal";
  const logoUrl = branding?.logo_url;
  const loginBgColor = branding?.login_bg_color;
  const loginBgImageUrl = branding?.login_bg_image_url;
  const loginBgOverlayOpacity = branding?.login_bg_overlay_opacity ?? 0.5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Verify reCAPTCHA if enabled
      if (authSettings?.recaptcha_enabled && authSettings?.recaptcha_site_key) {
        const token = await executeRecaptcha();
        if (token) {
          const recaptchaResult = await verifyRecaptcha(token, "login");
          if (!recaptchaResult.success) {
            setMessage({ type: "error", text: recaptchaResult.error || "reCAPTCHA verification failed" });
            setLoading(false);
            return;
          }
        }
      }

      if (password.trim()) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          setMessage({ type: "error", text: getAuthErrorMessage(error) });
          setLoading(false);
          return;
        }

        // Check if MFA is required
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const totpFactor = factorsData?.totp?.[0];

        if (totpFactor && totpFactor.status === "verified") {
          // User has MFA enabled, show verification screen
          setShowMFA(true);
          setLoading(false);
          return;
        }

        // No MFA required, redirect to dashboard
        window.location.href = "/dashboard";
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          setMessage({ type: "error", text: getAuthErrorMessage(error) });
        } else {
          setMessage({
            type: "success",
            text: "We've sent a magic link to your inbox. Please click it to sign in.",
          });
        }
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMFASuccess = () => {
    window.location.href = "/dashboard";
  };

  const handleMFACancel = async () => {
    // Sign out and return to login
    await supabase.auth.signOut();
    setShowMFA(false);
    setPassword("");
  };

  // Determine background styles - Note: URLs are validated server-side in portal branding
  // but we still validate here for defense in depth
  const hasCustomBackground = loginBgColor || loginBgImageUrl;
  const backgroundStyle: React.CSSProperties = {};

  if (loginBgImageUrl) {
    // URL is already validated by server, but we use it safely here
    // by setting it via React style object which escapes values
    try {
      new URL(loginBgImageUrl); // Validate URL format
      backgroundStyle.backgroundImage = `url(${loginBgImageUrl})`;
      backgroundStyle.backgroundSize = "cover";
      backgroundStyle.backgroundPosition = "center";
      backgroundStyle.backgroundRepeat = "no-repeat";
    } catch {
      // Invalid URL, skip background image
      console.warn("Invalid background image URL");
    }
  } else if (loginBgColor) {
    backgroundStyle.backgroundColor = loginBgColor;
  }

  // Show MFA verification screen
  if (showMFA) {
    return (
      <div
        className={cn(
          "flex min-h-screen items-center justify-center p-4 overflow-hidden relative",
          !hasCustomBackground &&
            "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black",
        )}
        style={hasCustomBackground ? backgroundStyle : undefined}
      >
        {loginBgImageUrl && <div className="absolute inset-0 bg-black" style={{ opacity: loginBgOverlayOpacity }} />}
        {!hasCustomBackground && (
          <>
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-blue-500/10 blur-[100px] rounded-full" />
          </>
        )}
        <div className="relative z-10">
          <MFAVerify onSuccess={handleMFASuccess} onCancel={handleMFACancel} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center p-4 overflow-hidden relative",
        !hasCustomBackground &&
          "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black",
      )}
      style={hasCustomBackground ? backgroundStyle : undefined}
    >
      {/* reCAPTCHA Script */}
      {authSettings?.recaptcha_enabled && authSettings?.recaptcha_site_key && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${authSettings.recaptcha_site_key}`}
          strategy="afterInteractive"
          onLoad={() => setRecaptchaLoaded(true)}
        />
      )}

      {/* Dark overlay for background image */}
      {loginBgImageUrl && <div className="absolute inset-0 bg-black" style={{ opacity: loginBgOverlayOpacity }} />}

      {/* Decorative Blur Elements - only show for default background */}
      {!hasCustomBackground && (
        <>
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-blue-500/10 blur-[100px] rounded-full" />
        </>
      )}

      <Card className="w-full max-w-md shadow-2xl border-slate-800 bg-slate-900/50 backdrop-blur-xl relative z-10 transition-all duration-500 hover:shadow-primary/5">
        <CardHeader className="space-y-2 pb-6">
          <div className="flex justify-center mb-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic user-provided logo URL
              <img src={logoUrl} alt={appName} className="h-14 w-auto max-w-[180px] object-contain" />
            ) : (
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20 rotate-3">
                <Mail className="text-white h-7 w-7" />
              </div>
            )}
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-center text-white">Welcome Back</CardTitle>
          <CardDescription className="text-center text-slate-400 text-base">{tagline}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300 font-medium ml-1">
                Email
              </Label>
              <div className="relative group">
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-950/50 border-slate-800 text-white h-12 px-4 focus:ring-primary focus:border-primary transition-all pr-12"
                  disabled={loading}
                  autoComplete="email"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
                  <Mail size={18} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 font-medium ml-1">
                Password
              </Label>
              <div className="relative group">
                <Input
                  id="password"
                  type="password"
                  placeholder="Leave blank for magic link"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/50 border-slate-800 text-white h-12 px-4 focus:ring-primary focus:border-primary transition-all pr-12"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
                  <Lock size={18} />
                </div>
              </div>
              <p className="text-xs text-slate-500">Leave blank to receive a sign-in link by email.</p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 font-semibold text-base bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10 transition-all hover:translate-y-[-1px] active:translate-y-0"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{password.trim() ? "Signing in..." : "Sending link..."}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>{password.trim() ? "Sign in" : "Send magic link"}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>

          {/* SSO Buttons */}
          {authSettings && (
            <SSOButtons
              enabledProviders={{
                google: authSettings.sso_google_enabled,
                microsoft: authSettings.sso_microsoft_enabled,
                github: authSettings.sso_github_enabled,
                apple: authSettings.sso_apple_enabled,
              }}
              disabled={loading}
              onError={(error) => setMessage({ type: "error", text: error })}
            />
          )}

          {message && (
            <div
              className={cn(
                "p-4 rounded-xl flex items-start gap-4 text-sm animate-in fade-in slide-in-from-top-4 duration-300",
                message.type === "success"
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20",
              )}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              )}
              <p className="leading-relaxed">{message.text}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col text-center space-y-6 pt-2 pb-8">
          <div className="flex items-center justify-between w-full px-1">
            <Link
              href="/forgot-password"
              className="text-sm text-slate-400 hover:text-white transition-colors underline-offset-4 hover:underline"
            >
              Trouble signing in?
            </Link>
            <span className="text-slate-700">|</span>
            <Link href="/signup" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              Request Access
            </Link>
          </div>
          {authSettings?.recaptcha_enabled && (
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Protected by reCAPTCHA.{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Privacy
              </a>{" "}
              &{" "}
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Terms
              </a>
            </p>
          )}
          <p className="text-[11px] text-slate-500 uppercase tracking-widest leading-relaxed opacity-60">{appName}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
