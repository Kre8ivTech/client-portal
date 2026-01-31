"use client";

import { useState } from "react";
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
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getAuthErrorMessage } from "@/lib/auth-errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const supabase = createClient();

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // In a magic-link first system, we just send another OTP
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
        text: "Recovery link sent. If an account exists for this email, you'll receive a sign-in link shortly.",
      });
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-950 font-sans">
      <Card className="w-full max-w-md shadow-2xl border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
              <HelpCircle className="text-primary h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-center text-white">
            Trouble signing in?
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            Enter your email and we&apos;ll send you a secure link to access your
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRecovery} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                Email Address
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
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 font-medium bg-primary hover:bg-primary/90 text-white transition-all"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                "Send Recovery Link"
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
        </CardFooter>
      </Card>
    </div>
  );
}
