import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { updateOrganizationSchema } from "@/lib/validators/organization";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * Check if user has access to the organization
 */
async function checkOrganizationAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  orgId: string
): Promise<{ canView: boolean; canEdit: boolean; role: string; userOrgId: string | null }> {
  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", userId)
    .single();

  type ProfileRow = { organization_id: string | null; role: string };
  const prof = profile as ProfileRow | null;
  const role = prof?.role ?? "client";
  const userOrgId = prof?.organization_id ?? null;

  // Super admins and staff can view/edit all
  if (role === "super_admin" || role === "staff") {
    return { canView: true, canEdit: true, role, userOrgId };
  }

  // Check if this is user's own organization
  if (userOrgId === orgId) {
    // Partners can edit their own org, clients can only view
    const canEdit = role === "partner" || role === "partner_staff";
    return { canView: true, canEdit, role, userOrgId };
  }

  // Check if this is a child organization of user's org (for partners)
  if (role === "partner" || role === "partner_staff") {
    const { data: org } = await supabase
      .from("organizations")
      .select("parent_org_id")
      .eq("id", orgId)
      .single();

    type OrgRow = { parent_org_id: string | null };
    const orgData = org as OrgRow | null;
    if (orgData && orgData.parent_org_id === userOrgId) {
      return { canView: true, canEdit: true, role, userOrgId };
    }
  }

  return { canView: false, canEdit: false, role, userOrgId };
}

/**
 * GET /api/organizations/[id]
 * Get a single organization by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: orgId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkOrganizationAccess(supabase, user.id, orgId);

    if (!access.canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the organization
    const { data: organization, error } = await supabase
      .from("organizations")
      .select("id, name, slug, type, status, parent_org_id, branding_config, settings, created_at, updated_at")
      .eq("id", orgId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get user count for the organization
    const { count: userCount } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);

    // Get plan assignment if exists
    const { data: planAssignment } = await supabase
      .from("plan_assignments")
      .select("id, status, plan:plans(id, name, monthly_fee), start_date, next_billing_date, support_hours_used, dev_hours_used")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .single();

    return NextResponse.json({
      data: {
        ...(organization as Record<string, unknown>),
        user_count: userCount ?? 0,
        plan_assignment: planAssignment,
        can_edit: access.canEdit,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organizations/[id]
 * Update an organization
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: orgId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkOrganizationAccess(supabase, user.id, orgId);

    if (!access.canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const result = updateOrganizationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const input = result.data;

    // If slug is being changed, check uniqueness
    if (input.slug) {
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", input.slug)
        .neq("id", orgId)
        .single();

      if (existingOrg) {
        return NextResponse.json(
          { error: "Organization with this slug already exists" },
          { status: 409 }
        );
      }
    }

    // Partners cannot change organization type to partner
    if (access.role === "partner" && input.type === "partner") {
      return NextResponse.json(
        { error: "Partners cannot create partner organizations" },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.status !== undefined) updateData.status = input.status;
    
    // Only admin/staff/partners can update branding (not clients)
    const canUpdateBranding = ["super_admin", "staff", "partner", "partner_staff"].includes(access.role);
    if (input.branding_config !== undefined && canUpdateBranding) {
      updateData.branding_config = input.branding_config;
    }
    
    if (input.settings !== undefined) updateData.settings = input.settings;

    // Only super_admin/staff can change parent_org_id
    if (input.parent_org_id !== undefined && (access.role === "super_admin" || access.role === "staff")) {
      updateData.parent_org_id = input.parent_org_id;
    }

    // Update the organization
    const { data: organization, error } = await (supabase as any)
      .from("organizations")
      .update(updateData)
      .eq("id", orgId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: organization });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organizations/[id]
 * Soft delete an organization (set status to 'inactive')
 * Only super_admin and staff can delete organizations
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: orgId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    type ProfileRow = { role: string };
    const role = (profile as ProfileRow | null)?.role ?? "client";

    // Only super_admin and staff can delete organizations
    if (role !== "super_admin" && role !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify organization exists
    const { data: existingOrg, error: fetchError } = await supabase
      .from("organizations")
      .select("id, status")
      .eq("id", orgId)
      .single();

    if (fetchError || !existingOrg) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Soft delete - set status to inactive
    const { data: organization, error } = await (supabase as any)
      .from("organizations")
      .update({
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: organization,
      message: "Organization has been deactivated",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
