import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeCustomDomain, verifyDomainCname } from "@/lib/white-label/domain-verification";

const verifyDomainSchema = z.object({
  organizationId: z.string().uuid(),
  domain: z.string().max(255).optional(),
});

type UserRow = {
  id: string;
  role: string;
  organization_id: string | null;
};

type OrganizationRow = {
  id: string;
  type: string;
  status: string;
  parent_org_id: string | null;
  custom_domain: string | null;
};

function canVerifyDomain(user: UserRow, org: OrganizationRow): boolean {
  if (user.role === "super_admin" || user.role === "staff") return true;

  const isPartnerRole = user.role === "partner" || user.role === "partner_staff";
  if (!isPartnerRole) return false;

  const isOwnOrg = user.organization_id === org.id;
  const isChildOrg = Boolean(user.organization_id) && org.parent_org_id === user.organization_id;
  return isOwnOrg || isChildOrg;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = verifyDomainSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }
    const { organizationId } = parsedBody.data;

    const { data: userData } = await (supabase as any)
      .from("users")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .single();

    const userRow = userData as UserRow | null;
    if (!userRow) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const { data: orgData } = await (supabase as any)
      .from("organizations")
      .select("id, type, status, parent_org_id, custom_domain")
      .eq("id", organizationId)
      .single();

    const orgRow = orgData as OrganizationRow | null;
    if (!orgRow) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (orgRow.type !== "partner") {
      return NextResponse.json({ error: "Custom domain verification is only supported for partner organizations" }, { status: 400 });
    }

    if (orgRow.status !== "active") {
      return NextResponse.json({ error: "Organization must be active to verify custom domain" }, { status: 400 });
    }

    if (!canVerifyDomain(userRow, orgRow)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const domain = normalizeCustomDomain(parsedBody.data.domain ?? orgRow.custom_domain);
    if (!domain) {
      return NextResponse.json(
        { error: "Enter a custom domain, then verify it." },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();
    const { data: existingDomain } = await admin
      .from("organizations")
      .select("id")
      .eq("custom_domain", domain)
      .neq("id", orgRow.id)
      .maybeSingle();

    if (existingDomain) {
      return NextResponse.json(
        { error: "This custom domain is already in use by another organization" },
        { status: 409 },
      );
    }

    const verification = await verifyDomainCname(domain);
    const now = new Date().toISOString();
    const updatePayload = verification.verified
      ? { custom_domain: domain, custom_domain_verified: true, custom_domain_verified_at: now, updated_at: now }
      : { custom_domain: domain, custom_domain_verified: false, custom_domain_verified_at: null, updated_at: now };

    const { error: updateError } = await admin
      .from("organizations")
      .update(updatePayload)
      .eq("id", orgRow.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      verified: verification.verified,
      domain,
      records: verification.records,
      expectedTargets: verification.expectedTargets,
      reason: verification.reason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
