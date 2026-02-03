"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

interface EmailChangeFormProps {
  currentEmail: string;
  role?: string | null;
}

export function EmailChangeForm({ currentEmail, role }: EmailChangeFormProps) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isSuperAdmin = role === "super_admin";

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!newEmail || (!isSuperAdmin && !password)) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(newEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (newEmail === currentEmail) {
      toast({
        title: "Error",
        description: "New email must be different from current email",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const payload: any = { newEmail };
      if (!isSuperAdmin) payload.password = password;

      const response = await fetch("/api/user/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change email");
      }

      toast({
        title: isSuperAdmin ? "Email Updated" : "Verification Email Sent",
        description:
          data.message ||
          (isSuperAdmin
            ? "Your email was updated successfully."
            : "Please check your inbox to verify your new email"),
      });

      // Reset form
      setNewEmail("");
      setPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentEmail">Current Email</Label>
        <Input
          id="currentEmail"
          type="email"
          value={currentEmail}
          disabled
          className="bg-slate-50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newEmail">New Email Address</Label>
        <Input
          id="newEmail"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="Enter new email address"
          disabled={loading}
        />
        <p className="text-xs text-slate-500">
          A verification email will be sent to your new address
        </p>
      </div>

      {!isSuperAdmin && (
        <div className="space-y-2">
          <Label htmlFor="password">Confirm Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating Email...
          </>
        ) : (
          "Update Email"
        )}
      </Button>
    </form>
  );
}
