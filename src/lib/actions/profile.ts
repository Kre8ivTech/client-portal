"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const name = (formData.get("name") as string)?.trim() ?? "";
  const avatarUrl = (formData.get("avatar_url") as string)?.trim();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const updates: { name: string; updated_at: string; avatar_url?: string } = {
    name,
    updated_at: new Date().toISOString(),
  };
  if (avatarUrl !== undefined && avatarUrl !== "") {
    updates.avatar_url = avatarUrl;
  }

  // @ts-expect-error - profiles update type may not be inferred until types are regenerated
  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/profile");
}
