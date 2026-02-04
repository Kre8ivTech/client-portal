"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface StripePortalButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function StripePortalButton({ variant = "default", size = "default", className = "" }: StripePortalButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      // Redirect to Stripe billing portal
      window.location.href = data.url;
    } catch (error: any) {
      console.error("Error opening billing portal:", error);
      alert(error.message || "Failed to open billing portal. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleClick} disabled={isLoading}>
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Opening...
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4" />
          Manage with Stripe
        </>
      )}
    </Button>
  );
}
