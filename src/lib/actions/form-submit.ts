"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitForm(formId: string, responses: Record<string, string | string[]>) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("organization_id").eq("id", user.id).single()
    : { data: null };

  const { error } = await (supabase as any).from("form_submissions").insert({
    form_id: formId,
    organization_id: (profile as { organization_id?: string } | null)?.organization_id ?? null,
    profile_id: user?.id ?? null,
    responses,
    status: "submitted",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/f/[slug]", "page");
  return { success: true };
}
