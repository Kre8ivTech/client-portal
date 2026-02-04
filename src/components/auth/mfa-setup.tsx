"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, ShieldCheck, ShieldOff, Copy, CheckCircle2, AlertCircle, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MFASetupProps {
  onComplete?: () => void;
  mfaEnabled?: boolean;
  onStatusChange?: (enabled: boolean) => void;
}

export function MFASetup({ onComplete, mfaEnabled = false, onStatusChange }: MFASetupProps) {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [copied, setCopied] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  // Start MFA enrollment
  const startEnrollment = async () => {
    setIsEnrolling(true);
    setError(null);

    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });

      if (enrollError) throw enrollError;

      if (data?.totp) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
      }
    } catch (err: any) {
      console.error("MFA enrollment error:", err);
      setError(err.message || "Failed to start MFA enrollment");
    } finally {
      setIsEnrolling(false);
    }
  };

  // Verify the TOTP code and complete enrollment
  const verifyEnrollment = async () => {
    if (!factorId || verifyCode.length !== 6) return;

    setIsVerifying(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      // Update user mfa_enabled status
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("users")
          .update({
            mfa_enabled: true,
            mfa_verified_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }

      toast({
        title: "MFA Enabled",
        description: "Two-factor authentication has been successfully enabled.",
      });

      onStatusChange?.(true);
      onComplete?.();

      // Reset state
      setQrCode(null);
      setSecret(null);
      setFactorId(null);
      setVerifyCode("");
    } catch (err: any) {
      console.error("MFA verification error:", err);
      setError(err.message || "Invalid verification code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Disable MFA
  const disableMFA = async () => {
    if (disableCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setIsDisabling(true);
    setError(null);

    try {
      // Get existing factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) throw factorsError;

      const totpFactor = factorsData?.totp?.[0];
      if (!totpFactor) {
        throw new Error("No MFA factor found");
      }

      // Challenge and verify before unenrolling
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: disableCode,
      });

      if (verifyError) throw verifyError;

      // Unenroll the factor
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: totpFactor.id,
      });

      if (unenrollError) throw unenrollError;

      // Update user mfa_enabled status
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("users")
          .update({
            mfa_enabled: false,
            mfa_verified_at: null,
          })
          .eq("id", user.id);
      }

      toast({
        title: "MFA Disabled",
        description: "Two-factor authentication has been disabled.",
      });

      onStatusChange?.(false);
      setShowDisableDialog(false);
      setDisableCode("");
    } catch (err: any) {
      console.error("MFA disable error:", err);
      setError(err.message || "Failed to disable MFA. Please check your code.");
    } finally {
      setIsDisabling(false);
    }
  };

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const cancelEnrollment = () => {
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
    setVerifyCode("");
    setError(null);
  };

  // Enrollment flow
  if (qrCode && secret) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Set Up Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-lg">
              <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
            </div>
          </div>

          {/* Manual entry */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Or enter this code manually:</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">{secret}</code>
              <Button type="button" variant="outline" size="icon" onClick={copySecret}>
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Verify code */}
          <div className="space-y-2">
            <Label>Enter the 6-digit code from your app</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center text-2xl tracking-widest font-mono"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={cancelEnrollment} className="flex-1">
              Cancel
            </Button>
            <Button onClick={verifyEnrollment} disabled={verifyCode.length !== 6 || isVerifying} className="flex-1">
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Enable MFA
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Status display
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Smartphone className="h-5 w-5" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </div>
            <Badge variant={mfaEnabled ? "default" : "secondary"}>
              {mfaEnabled ? (
                <>
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Enabled
                </>
              ) : (
                <>
                  <ShieldOff className="h-3 w-3 mr-1" />
                  Disabled
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {mfaEnabled
              ? "Your account is protected with two-factor authentication. You will need your authenticator app when signing in."
              : "Protect your account by requiring a verification code from your phone in addition to your password."}
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {mfaEnabled ? (
            <Button variant="destructive" onClick={() => setShowDisableDialog(true)}>
              <ShieldOff className="mr-2 h-4 w-4" />
              Disable MFA
            </Button>
          ) : (
            <Button onClick={startEnrollment} disabled={isEnrolling}>
              {isEnrolling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Enable MFA
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Disable MFA Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your authenticator code to confirm disabling MFA. This will make your account less secure.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Verification Code</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDisableDialog(false);
                setDisableCode("");
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={disableMFA} disabled={disableCode.length !== 6 || isDisabling}>
              {isDisabling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                "Disable MFA"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
