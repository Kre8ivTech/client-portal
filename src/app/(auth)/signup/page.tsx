"use client";

import { useEffect, useState } from "react";
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
  ChevronLeft,
  Loader2,
  UserPlus,
  Lock,
} from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { cn } from "@/lib/utils";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { getAuthSettings, verifyRecaptcha, type AuthSettings } from "@/lib/actions/auth-settings";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [authSettings, setAuthSettings] = useState<AuthSettings | null>(null);
  const supabase = createClient();

  useEffect(() => {
    void getAuthSettings().then(setAuthSettings);
  }, []);

  const executeRecaptcha = async (action: string): Promise<string | null> => {
    if (!authSettings?.recaptcha_enabled || !authSettings.recaptcha_site_key) {
      return null;
    }

    try {
      if (typeof window !== "undefined" && window.grecaptcha) {
        return await window.grecaptcha.execute(authSettings.recaptcha_site_key, { action });
      }
    } catch {
      // Ignore and return null; caller handles error.
    }
    return null;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (authSettings?.recaptcha_enabled && authSettings?.recaptcha_site_key) {
        const recaptchaAction = password.trim() ? "signup_password" : "signup_magic_link";
        const recaptchaToken = await executeRecaptcha(recaptchaAction);
        if (!recaptchaToken) {
          setMessage({ type: "error", text: "Could not complete reCAPTCHA verification" });
          setLoading(false);
          return;
        }

        const recaptchaResult = await verifyRecaptcha(recaptchaToken, recaptchaAction);
        if (!recaptchaResult.success) {
          setMessage({
            type: "error",
            text: recaptchaResult.error || "reCAPTCHA verification failed",
          });
          setLoading(false);
          return;
        }
      }

      if (password.trim()) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          setMessage({ type: "error", text: getAuthErrorMessage(error) });
        } else if (data.session) {
          window.location.href = "/dashboard";
        } else {
          setMessage({
            type: "success",
            text: "Check your email to confirm your account, then sign in.",
          });
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
            text: "We've sent a verification link to your email. Please click it to continue.",
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
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-950 font-sans">
      {authSettings?.recaptcha_enabled && authSettings?.recaptcha_site_key && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${authSettings.recaptcha_site_key}`}
          strategy="afterInteractive"
        />
      )}
      <Card className="w-full max-w-md shadow-2xl border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
              <UserPlus className="text-primary h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-center text-white">
            Request Access
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            Create an account with email and password, or request a magic link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950/50 border-slate-800 text-white h-11"
                disabled={loading}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Leave blank for magic link"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/50 border-slate-800 text-white h-11"
                disabled={loading}
                autoComplete="new-password"
              />
              <p className="text-xs text-slate-500">
                Leave blank to receive a sign-in link by email instead.
              </p>
            </div>
            <Button
              type="submit"
              className="w-full h-11 font-medium bg-primary hover:bg-primary/90 text-white transition-all"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : password.trim() ? (
                "Create account"
              ) : (
                "Send magic link"
              )}
            </Button>
          </form>

          {message && (
            <div
              className={cn(
                "mt-4 p-3 rounded-lg flex items-start gap-3 text-sm",
                message.type === "success"
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20",
              )}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0" />
              )}
              <p>{message.text}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col text-center border-t border-slate-800/50 mt-2 py-6">
          <Link
            href="/login"
            className="text-sm text-slate-400 hover:text-white flex items-center gap-2 transition-colors mx-auto"
          >
            <ChevronLeft size={16} />
            Back to login
          </Link>
          {authSettings?.recaptcha_enabled && (
            <p className="mt-4 text-[10px] text-slate-600 leading-relaxed">
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
        </CardFooter>
      </Card>
    </div>
  );
}
