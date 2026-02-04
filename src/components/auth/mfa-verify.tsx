"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, AlertCircle, ArrowLeft } from "lucide-react";

interface MFAVerifyProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function MFAVerify({ onSuccess, onCancel }: MFAVerifyProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    // Get the MFA factor ID
    const getFactorId = async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const totpFactor = data?.totp?.[0];
      if (totpFactor) {
        setFactorId(totpFactor.id);
      }
    };
    getFactorId();
    inputRef.current?.focus();
  }, []);

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return;

    setLoading(true);
    setError(null);

    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      onSuccess();
    } catch (err: any) {
      console.error("MFA verification error:", err);
      setError("Invalid code. Please try again.");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length === 6) {
      handleVerify();
    }
  };

  return (
    <Card className="w-full max-w-md shadow-2xl border-slate-800 bg-slate-900/50 backdrop-blur-xl">
      <CardHeader className="space-y-2 pb-6">
        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <Shield className="text-white h-7 w-7" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-center text-white">
          Two-Factor Authentication
        </CardTitle>
        <CardDescription className="text-center text-slate-400">
          Enter the 6-digit code from your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="mfa-code" className="text-slate-300 font-medium ml-1">
            Verification Code
          </Label>
          <Input
            ref={inputRef}
            id="mfa-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={handleKeyDown}
            placeholder="000000"
            className="text-center text-3xl tracking-[0.5em] font-mono h-14 bg-slate-950/50 border-slate-800 text-white"
            disabled={loading}
            autoComplete="one-time-code"
          />
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleVerify}
          disabled={code.length !== 6 || loading}
          className="w-full h-12 font-semibold text-base bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>

        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className="w-full text-slate-400 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to login
          </Button>
        )}

        <p className="text-xs text-slate-500 text-center">
          Open your authenticator app (Google Authenticator, Authy, etc.) to view your code.
        </p>
      </CardContent>
    </Card>
  );
}
