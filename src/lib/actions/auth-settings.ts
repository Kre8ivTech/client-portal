"use server";

import { createClient } from "@supabase/supabase-js";

export interface AuthSettings {
  sso_google_enabled: boolean;
  sso_microsoft_enabled: boolean;
  sso_github_enabled: boolean;
  sso_apple_enabled: boolean;
  recaptcha_enabled: boolean;
  recaptcha_site_key: string | null;
  mfa_enabled: boolean;
  mfa_required_for_staff: boolean;
  mfa_required_for_clients: boolean;
}

const defaultSettings: AuthSettings = {
  sso_google_enabled: false,
  sso_microsoft_enabled: false,
  sso_github_enabled: false,
  sso_apple_enabled: false,
  recaptcha_enabled: false,
  recaptcha_site_key: null,
  mfa_enabled: true,
  mfa_required_for_staff: false,
  mfa_required_for_clients: false,
};

export async function getAuthSettings(): Promise<AuthSettings> {
  try {
    // Use service role to bypass RLS for public auth settings
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return defaultSettings;
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select(
        `
        sso_google_enabled,
        sso_microsoft_enabled,
        sso_github_enabled,
        sso_apple_enabled,
        recaptcha_enabled,
        recaptcha_site_key,
        mfa_enabled,
        mfa_required_for_staff,
        mfa_required_for_clients
      `,
      )
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single();

    if (error) {
      // Table or columns might not exist yet (e.g., migrations pending in preview environments)
      if (error.message?.includes("does not exist")) {
        console.info("Auth settings columns not found (using defaults):", error.message);
      } else {
        console.warn("Auth settings fetch error:", error.message);
      }
      return defaultSettings;
    }

    return {
      sso_google_enabled: data?.sso_google_enabled ?? false,
      sso_microsoft_enabled: data?.sso_microsoft_enabled ?? false,
      sso_github_enabled: data?.sso_github_enabled ?? false,
      sso_apple_enabled: data?.sso_apple_enabled ?? false,
      recaptcha_enabled: data?.recaptcha_enabled ?? false,
      recaptcha_site_key: data?.recaptcha_site_key ?? null,
      mfa_enabled: data?.mfa_enabled ?? true,
      mfa_required_for_staff: data?.mfa_required_for_staff ?? false,
      mfa_required_for_clients: data?.mfa_required_for_clients ?? false,
    };
  } catch (err) {
    console.error("Failed to get auth settings:", err);
    return defaultSettings;
  }
}

export async function verifyRecaptcha(
  token: string,
  action: string = "login",
  remoteIp?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!token || token.trim().length === 0) {
      return { success: false, error: "Missing reCAPTCHA token" }
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { success: false, error: "Server configuration error (missing Supabase credentials)" }
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("recaptcha_enabled, recaptcha_secret_key")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single();

    if (!settings?.recaptcha_enabled) {
      return { success: true }
    }

    if (!settings?.recaptcha_secret_key) {
      return { success: false, error: "reCAPTCHA is enabled but not configured" }
    }

    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret: settings.recaptcha_secret_key,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: "reCAPTCHA verification failed" };
    }

    // For v3, check the score
    if (data.score !== undefined && data.score < 0.5) {
      return { success: false, error: "Suspicious activity detected" };
    }

    // Verify action matches
    if (data.action && data.action !== action) {
      return { success: false, error: "Invalid reCAPTCHA action" };
    }

    return { success: true };
  } catch (err) {
    console.error("reCAPTCHA verification error:", err);
    return { success: false, error: "Failed to verify reCAPTCHA" };
  }
}
