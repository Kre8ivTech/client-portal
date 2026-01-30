"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { updateProfileSchema } from "@/lib/validators/profile";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const supabase = (await createServerSupabaseClient()) as any;

  const result = updateProfileSchema.safeParse({
    name: formData.get("name"),
    avatar_url: formData.get("avatar_url"),
  });

  if (!result.success) {
    throw new Error("Validation failed");
  }

  const { name, avatar_url } = result.data;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      name,
      avatar_url: avatar_url ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/profile");
  return { success: true };
}
