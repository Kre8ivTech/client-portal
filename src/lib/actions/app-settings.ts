"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const APP_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export type AppSettings = {
  stripe_mode: "test" | "live";
  stripe_live_secret_key: string | null;
  stripe_live_webhook_secret: string | null;
  stripe_test_secret_key: string | null;
  stripe_test_webhook_secret: string | null;
  ai_provider_primary: string | null;
  openrouter_api_key: string | null;
  anthropic_api_key: string | null;
  openai_api_key: string | null;
  gemini_api_key: string | null;
  timezone: string | null;
};

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", APP_SETTINGS_ID)
    .single();

  if (error || !data) {
    return {
      stripe_mode: "test",
      stripe_live_secret_key: null,
      stripe_live_webhook_secret: null,
      stripe_test_secret_key: null,
      stripe_test_webhook_secret: null,
      ai_provider_primary: "openrouter",
      openrouter_api_key: null,
      anthropic_api_key: null,
      openai_api_key: null,
      gemini_api_key: null,
      timezone: null,
    };
  }

  return data as AppSettings;
}

export async function updateAppSettings(payload: Partial<AppSettings>): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as { role?: string } | null)?.role;
  if (role !== "super_admin") {
    return { success: false, error: "Only super_admin can update settings." };
  }

  const { error } = await (supabase as any)
    .from("app_settings")
    .update(payload)
    .eq("id", APP_SETTINGS_ID);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/settings/ai");
  revalidatePath("/dashboard/settings/integrations");
  revalidatePath("/dashboard/settings");
  return { success: true };
}

// Keep backward compatibility for existing calls
export async function updateStripeSettings(payload: Partial<AppSettings>) {
  return updateAppSettings(payload);
}
