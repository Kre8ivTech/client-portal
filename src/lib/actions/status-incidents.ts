"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(8).max(4000),
  severity: z.enum(["maintenance", "degraded", "outage"]),
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
});

export async function createStatusIncident(input: z.input<typeof schema>) {
  const { user } = await requireRole(["super_admin", "staff"]);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message || "Check the incident" };

  const supabase = await createServerSupabaseClient();
  const resolved = parsed.data.status === "resolved";
  const { error } = await supabase.from("status_incidents").insert({
    title: parsed.data.title,
    body: parsed.data.body,
    severity: parsed.data.severity,
    status: parsed.data.status,
    is_public: true,
    resolved_at: resolved ? new Date().toISOString() : null,
    created_by: user.id,
  });
  if (error) return { success: false as const, error: error.message };

  revalidatePath("/dashboard/admin/status");
  revalidatePath("/status");
  return { success: true as const };
}

export async function resolveStatusIncident(id: string) {
  await requireRole(["super_admin", "staff"]);
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { success: false as const, error: "Choose an incident" };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("status_incidents")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", parsed.data);
  if (error) return { success: false as const, error: error.message };

  revalidatePath("/dashboard/admin/status");
  revalidatePath("/status");
  return { success: true as const };
}
