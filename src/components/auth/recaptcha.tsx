"use client";

import { useEffect, useRef, useCallback } from "react";
import Script from "next/script";

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render: (container: string | HTMLElement, options: any) => number;
      reset: (widgetId?: number) => void;
    };
    onRecaptchaLoad?: () => void;
  }
}

interface ReCaptchaProps {
  siteKey: string;
  action?: string;
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpired?: () => void;
}

// Invisible reCAPTCHA v3
export function ReCaptchaV3({ siteKey, action = "login", onVerify, onError }: ReCaptchaProps) {
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const executeRecaptcha = useCallback(async () => {
    if (!siteKey || typeof window === "undefined") return;

    try {
      await new Promise<void>((resolve) => {
        if (window.grecaptcha) {
          window.grecaptcha.ready(resolve);
        } else {
          window.onRecaptchaLoad = resolve;
        }
      });

      const token = await window.grecaptcha.execute(siteKey, { action });

      if (mounted.current) {
        onVerify(token);
      }
    } catch (err: any) {
      console.error("reCAPTCHA error:", err);
      if (mounted.current) {
        onError?.("reCAPTCHA verification failed. Please try again.");
      }
    }
  }, [siteKey, action, onVerify, onError]);

  useEffect(() => {
    if (siteKey) {
      executeRecaptcha();
    }
  }, [siteKey, executeRecaptcha]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
        strategy="afterInteractive"
        onLoad={() => {
          if (window.onRecaptchaLoad) {
            window.grecaptcha?.ready(window.onRecaptchaLoad);
          }
        }}
      />
      <input type="hidden" name="recaptcha_action" value={action} />
    </>
  );
}

// Hook for using reCAPTCHA v3
export function useReCaptcha(siteKey: string | null) {
  const executeRecaptcha = useCallback(
    async (action: string = "submit"): Promise<string | null> => {
      if (!siteKey || typeof window === "undefined" || !window.grecaptcha) {
        return null;
      }

      try {
        await new Promise<void>((resolve) => {
          window.grecaptcha.ready(resolve);
        });

        const token = await window.grecaptcha.execute(siteKey, { action });
        return token;
      } catch (err) {
        console.error("reCAPTCHA execution error:", err);
        return null;
      }
    },
    [siteKey],
  );

  return { executeRecaptcha };
}

// Verify reCAPTCHA token on server
export async function verifyRecaptchaToken(
  token: string,
  secretKey: string,
  expectedAction?: string,
): Promise<{ success: boolean; score?: number; error?: string }> {
  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: "reCAPTCHA verification failed" };
    }

    // For v3, check the score (0.0 - 1.0, higher is more likely human)
    if (data.score !== undefined && data.score < 0.5) {
      return { success: false, score: data.score, error: "reCAPTCHA score too low" };
    }

    // Check action if provided
    if (expectedAction && data.action !== expectedAction) {
      return { success: false, error: "reCAPTCHA action mismatch" };
    }

    return { success: true, score: data.score };
  } catch (err) {
    console.error("reCAPTCHA verification error:", err);
    return { success: false, error: "Failed to verify reCAPTCHA" };
  }
}
