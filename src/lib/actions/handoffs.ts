"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().min(8).max(5000),
  liveUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  ownerName: z.string().trim().max(120).optional().default(""),
  updateNotes: z.string().trim().max(2000).optional().default(""),
});

export async function createClientHandoff(input: z.input<typeof schema>) {
  const { user } = await requireRole(["super_admin", "staff"]);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message || "Check the handoff" };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("client_handoffs").insert({
    organization_id: parsed.data.organizationId,
    title: parsed.data.title,
    summary: parsed.data.summary,
    live_url: parsed.data.liveUrl || null,
    owner_name: parsed.data.ownerName || null,
    update_notes: parsed.data.updateNotes || null,
    created_by: user.id,
  });
  if (error) return { success: false as const, error: error.message };

  revalidatePath("/dashboard/handoffs");
  return { success: true as const };
}
