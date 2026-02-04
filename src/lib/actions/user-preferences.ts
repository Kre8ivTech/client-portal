"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateUserTimezone(timezone: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  // Validate timezone format (basic check)
  if (!timezone || timezone.length > 100) {
    return { success: false, error: "Invalid timezone" };
  }

  const { error } = await supabase.from("users").update({ timezone }).eq("id", user.id);

  if (error) {
    console.error("Error updating user timezone:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function getUserTimezone(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase.from("users").select("timezone").eq("id", user.id).single();

  return (data as { timezone?: string | null } | null)?.timezone || null;
}
