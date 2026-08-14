import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type GoogleAdsPartnerContext = {
  userId: string;
  organizationId: string;
  role: "partner" | "partner_staff";
};

type PartnerContextResult =
  | { ok: true; context: GoogleAdsPartnerContext }
  | { ok: false; response: NextResponse };

export async function getGoogleAdsPartnerContext(options?: {
  allowPartnerStaff?: boolean;
}): Promise<PartnerContextResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data, error } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();
  const profile = data as { organization_id: string | null; role: string } | null;
  const allowedRoles = options?.allowPartnerStaff ? ["partner", "partner_staff"] : ["partner"];
  if (error || !profile?.organization_id || !allowedRoles.includes(profile.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return {
    ok: true,
    context: {
      userId: user.id,
      organizationId: profile.organization_id,
      role: profile.role as "partner" | "partner_staff",
    },
  };
}
