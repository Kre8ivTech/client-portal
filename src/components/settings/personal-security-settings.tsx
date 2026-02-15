"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2, Mail, Shield, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { MFASetup } from "@/components/auth/mfa-setup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PersonalSecuritySettingsProps {
  userEmail: string;
  mfaEnabled?: boolean;
  mfaRequired?: boolean;
}

export function PersonalSecuritySettings({
  userEmail,
  mfaEnabled: initialMfaEnabled = false,
  mfaRequired = false,
}: PersonalSecuritySettingsProps) {
  const { toast } = useToast();
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [mfaStatus, setMfaStatus] = useState(initialMfaEnabled);
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const supabase = createClient();

  // Check MFA status on mount
  useEffect(() => {
    const checkMfaStatus = async () => {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        const totpFactor = data?.totp?.[0];
        if (totpFactor && totpFactor.status === "verified") {
          setMfaStatus(true);
        }
      } catch (err) {
        // Ignore errors
      }
    };
    checkMfaStatus();
  }, []);

  const handlePasswordChange = async () => {
    if (passwords.new !== passwords.confirm) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (passwords.new.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new,
      });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Password updated successfully" });
        setPasswords({ current: "", new: "", confirm: "" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSendPasswordReset = async () => {
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings/security`,
      });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "Email Sent",
          description: `A password reset link has been sent to ${userEmail}`,
        });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <>
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <KeyRound className="text-primary w-5 h-5" />
            Account Security
          </CardTitle>
          <CardDescription>Manage your password and account security settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {mfaRequired && !mfaStatus && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-900">
              <Shield className="h-4 w-4" />
              <div>
                <AlertTitle>MFA required</AlertTitle>
                <AlertDescription>
                  You must enable two-factor authentication to continue using the portal.
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Current Email Display */}
          <div className="space-y-2">
            <Label>Email Address</Label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
              <Mail className="w-4 h-4" />
              {userEmail}
            </div>
          </div>

          {/* Password Change Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Change Password</Label>
                <p className="text-sm text-muted-foreground">
                  Update your password directly or request a reset link via email.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPasswords(!showPasswords)}
                className="text-muted-foreground"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type={showPasswords ? "text" : "password"}
                  placeholder="Enter new password"
                  value={passwords.new}
                  onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type={showPasswords ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handlePasswordChange}
                disabled={changingPassword || !passwords.new || !passwords.confirm}
              >
                {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <KeyRound className="mr-2 h-4 w-4" />
                Update Password
              </Button>
              <Button variant="outline" onClick={handleSendPasswordReset} disabled={sendingReset}>
                {sendingReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Mail className="mr-2 h-4 w-4" />
                Send Reset Link
              </Button>
            </div>
          </div>

          {/* Security Tips */}
          <div className="pt-4 border-t">
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">Security Tips</p>
                <ul className="mt-1 text-blue-700 dark:text-blue-300 space-y-1">
                  <li>Use a strong, unique password with at least 8 characters</li>
                  <li>Include a mix of letters, numbers, and symbols</li>
                  <li>Never share your password with anyone</li>
                  <li>Consider using a password manager</li>
                  <li>Enable two-factor authentication for extra security</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MFA Setup Section */}
      <MFASetup mfaEnabled={mfaStatus} onStatusChange={setMfaStatus} />
    </>
  );
}
