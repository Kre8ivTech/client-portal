"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  url: z.string().trim().url().max(300),
  platform: z.string().trim().max(80).optional().default(""),
  maintenanceWindow: z.string().trim().max(160).optional().default(""),
  careNotes: z.string().trim().max(2000).optional().default(""),
});

export async function addSiteMonitor(input: z.input<typeof schema>) {
  await requireRole(["super_admin", "staff"]);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message || "Check the site details" };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("site_monitors").insert({
    organization_id: parsed.data.organizationId,
    name: parsed.data.name,
    url: parsed.data.url,
    platform: parsed.data.platform || null,
    maintenance_window: parsed.data.maintenanceWindow || null,
    care_notes: parsed.data.careNotes || null,
    status: "unknown",
  });
  if (error) return { success: false as const, error: error.message };

  revalidatePath("/dashboard/sites");
  return { success: true as const };
}
