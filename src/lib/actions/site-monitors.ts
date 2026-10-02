"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/require-role";
import {
  SITE_MONITOR_TARGET_ERROR,
  isPartnerSiteMonitorCreator,
  isPlatformSiteMonitorManager,
  partnerCanAttachSiteMonitor,
} from "@/lib/sites/site-monitor-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  url: z.string().trim().url().max(300),
  platform: z.string().trim().max(80).optional().default(""),
  maintenanceWindow: z.string().trim().max(160).optional().default(""),
  careNotes: z.string().trim().max(2000).optional().default(""),
});

type OrganizationTarget = {
  id: string;
  parent_org_id: string | null;
  type: string | null;
};

export async function addSiteMonitor(input: z.input<typeof schema>) {
  const { role, profile } = await requireRole(["super_admin", "staff", "partner", "partner_staff"]);
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message || "Check the site details" };
  }

  const supabase = await createServerSupabaseClient();

  if (isPartnerSiteMonitorCreator(role)) {
    const actorOrganizationId = profile?.organization_id ?? null;
    if (!actorOrganizationId) {
      return { success: false as const, error: SITE_MONITOR_TARGET_ERROR };
    }

    const { data, error: orgError } = await supabase
      .from("organizations")
      .select("id, parent_org_id, type")
      .in("id", [actorOrganizationId, parsed.data.organizationId]);

    if (orgError) return { success: false as const, error: orgError.message };

    const organizations = (data ?? []) as OrganizationTarget[];
    const actorOrg = organizations.find((org) => org.id === actorOrganizationId) ?? null;
    const targetOrg = organizations.find((org) => org.id === parsed.data.organizationId) ?? null;
    const allowed = partnerCanAttachSiteMonitor({
      actorOrganizationId,
      actorOrganizationType: actorOrg?.type ?? null,
      target: targetOrg ? { parentOrgId: targetOrg.parent_org_id, type: targetOrg.type } : null,
    });

    if (!allowed) return { success: false as const, error: SITE_MONITOR_TARGET_ERROR };
  } else if (!isPlatformSiteMonitorManager(role)) {
    return { success: false as const, error: SITE_MONITOR_TARGET_ERROR };
  }

  const { error } = await supabase.from("site_monitors").insert({
    organization_id: parsed.data.organizationId,
    name: parsed.data.name,
    url: parsed.data.url,
    platform: parsed.data.platform || null,
    maintenance_window: parsed.data.maintenanceWindow || null,
    care_notes: parsed.data.careNotes || null,
    status: "unknown",
  });
  if (error) {
    const denied = error.code === "42501" || /row-level security/i.test(error.message);
    return {
      success: false as const,
      error: denied ? SITE_MONITOR_TARGET_ERROR : error.message,
    };
  }

  revalidatePath("/dashboard/sites");
  revalidatePath("/dashboard/partner-overview/sites");
  return { success: true as const };
}
