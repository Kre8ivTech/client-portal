import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createOrganizationSchema, listOrganizationsQuerySchema } from "@/lib/validators/organization";

/**
 * GET /api/organizations
 * List organizations with filtering based on user role:
 * - super_admin/staff: All organizations
 * - partner: Own organization + child organizations
 * - client: Own organization only
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile with role and organization
    const { data: profile } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    type ProfileRow = { organization_id: string | null; role: string };
    const prof = profile as ProfileRow | null;
    const role = prof?.role ?? "client";
    const organizationId = prof?.organization_id ?? null;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      type: searchParams.get("type") || undefined,
      status: searchParams.get("status") || undefined,
      parent_org_id: searchParams.get("parent_org_id") || undefined,
      search: searchParams.get("search") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0,
    };

    const result = listOrganizationsQuerySchema.safeParse(queryParams);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const query = result.data;

    // Build the base query
    let dbQuery = supabase
      .from("organizations")
      .select("id, name, slug, type, status, parent_org_id, branding_config, settings, created_at, updated_at", { count: "exact" });

    // Apply role-based filtering
    if (role === "super_admin" || role === "staff") {
      // Super admins and staff can see all organizations
    } else if (role === "partner" || role === "partner_staff") {
      // Partners can see their own org and child organizations
      if (organizationId) {
        dbQuery = dbQuery.or(`id.eq.${organizationId},parent_org_id.eq.${organizationId}`);
      } else {
        return NextResponse.json({ data: [], count: 0 });
      }
    } else {
      // Clients can only see their own organization
      if (organizationId) {
        dbQuery = dbQuery.eq("id", organizationId);
      } else {
        return NextResponse.json({ data: [], count: 0 });
      }
    }

    // Apply filters
    if (query.type) {
      dbQuery = dbQuery.eq("type", query.type);
    }
    if (query.status) {
      dbQuery = dbQuery.eq("status", query.status);
    }
    if (query.parent_org_id) {
      dbQuery = dbQuery.eq("parent_org_id", query.parent_org_id);
    }
    if (query.search) {
      dbQuery = dbQuery.or(`name.ilike.%${query.search}%,slug.ilike.%${query.search}%`);
    }

    // Apply pagination
    dbQuery = dbQuery
      .order("name", { ascending: true })
      .range(query.offset, query.offset + query.limit - 1);

    const { data: organizations, error, count } = await dbQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: organizations,
      count: count ?? 0,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations
 * Create a new organization
 * Only super_admin, staff, and partners can create organizations
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile with role
    const { data: profile } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    type ProfileRow = { organization_id: string | null; role: string };
    const prof = profile as ProfileRow | null;
    const role = prof?.role ?? "client";
    const organizationId = prof?.organization_id ?? null;

    // Only allow super_admin, staff, and partners to create organizations
    if (!["super_admin", "staff", "partner"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const result = createOrganizationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const input = result.data;

    // Check if slug is unique
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", input.slug)
      .single();

    if (existingOrg) {
      return NextResponse.json(
        { error: "Organization with this slug already exists" },
        { status: 409 }
      );
    }

    // Partners can only create client organizations under themselves
    if (role === "partner") {
      if (input.type !== "client") {
        return NextResponse.json(
          { error: "Partners can only create client organizations" },
          { status: 403 }
        );
      }
      // Force parent_org_id to be the partner's organization
      input.parent_org_id = organizationId;
    }

    // Create the organization
    const { data: organization, error } = await (supabase as any)
      .from("organizations")
      .insert({
        name: input.name,
        slug: input.slug,
        type: input.type,
        status: input.status,
        parent_org_id: input.parent_org_id,
        branding_config: input.branding_config,
        settings: input.settings,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: organization }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
