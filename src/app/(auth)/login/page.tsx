"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Mail,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getPortalBranding } from "@/lib/actions/portal-branding";
import { getAuthErrorMessage } from "@/lib/auth-errors";

type LoginBranding = {
  app_name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  favicon_url: string | null;
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
  const supabase = createClient();

  useEffect(() => {
    getPortalBranding().then(setBranding);
  }, []);

  // Password reset links sometimes land on /?code=... when Supabase Site URL has no path. Send to callback then /reset-password.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("code")) {
  // Show message when redirected with auth_callback_failed (e.g. callback URL not in Supabase Redirect URLs)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth_callback_failed") {
      setMessage({
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const appName = branding?.app_name ?? "KT-Portal";
  const tagline = branding?.tagline ?? "Client Portal";
  const logoUrl = branding?.logo_url;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (password.trim()) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage({ type: "error", text: getAuthErrorMessage(error) });
        } else {
          window.location.href = "/dashboard";
        }
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

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-hidden relative">
      {/* Decorative Blur Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-blue-500/10 blur-[100px] rounded-full" />

      <Card className="w-full max-w-md shadow-2xl border-slate-800 bg-slate-900/50 backdrop-blur-xl relative z-10 transition-all duration-500 hover:shadow-primary/5">
        <CardHeader className="space-y-2 pb-8">
          <div className="flex justify-center mb-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic user-provided logo URL
              <img
                src={logoUrl}
                alt={appName}
                className="h-14 w-auto max-w-[180px] object-contain"
              />
            ) : (
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20 rotate-3">
                <Mail className="text-white h-7 w-7" />
              </div>
            )}
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-center text-white">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-center text-slate-400 text-base">
            {tagline}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-slate-300 font-medium ml-1"
              >
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
              <Label
                htmlFor="password"
                className="text-slate-300 font-medium ml-1"
              >
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
              <p className="text-xs text-slate-500">
                Leave blank to receive a sign-in link by email.
              </p>
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

          {message && (
            <div
              className={cn(
                "mt-6 p-4 rounded-xl flex items-start gap-4 text-sm animate-in fade-in slide-in-from-top-4 duration-300",
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
            <Link
              href="/signup"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Request Access
            </Link>
          </div>
          <p className="text-[11px] text-slate-500 uppercase tracking-widest leading-relaxed opacity-60">
            {appName}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
