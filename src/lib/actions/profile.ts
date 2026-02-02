"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";

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

  const { error } = await (supabase as any).from("profiles").update(updates).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  await writeAuditLog({
    action: "profile.update",
    entity_type: "profile",
    entity_id: user.id,
    new_values: { name, avatar_url: avatarUrl !== undefined },
  });

  revalidatePath("/dashboard/profile");
}

export async function updateAvatar(avatarUrl: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { error } = await (supabase as any)
    .from("profiles")
    .update({ 
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  await writeAuditLog({
    action: "profile.update",
    entity_type: "profile",
    entity_id: user.id,
    new_values: { avatar_url: avatarUrl },
  });

  revalidatePath("/dashboard/profile");
}
