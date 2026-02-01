import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { templateCreateSchema } from "@/lib/validators/contract-template";

/**
 * GET /api/contracts/templates
 * List templates with filtering based on user role:
 * - super_admin/staff: All templates including global ones
 * - partner/client: Own organization's templates + global templates
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
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20;
    const contract_type = searchParams.get("contract_type") || undefined;
    const is_active = searchParams.get("is_active") === "false" ? false : true;

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid pagination parameters" },
        { status: 400 }
      );
    }

    const offset = (page - 1) * limit;

    // Build the base query
    let dbQuery = supabase
      .from("contract_templates")
      .select("id, name, description, contract_type, organization_id, created_by, is_active, created_at, updated_at", { count: "exact" });

    // Apply role-based filtering
    if (role === "super_admin" || role === "staff") {
      // Super admins and staff can see all templates
    } else {
      // Other users can see their org's templates + global templates
      if (organizationId) {
        dbQuery = dbQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
      } else {
        // Users without org can only see global templates
        dbQuery = dbQuery.is("organization_id", null);
      }
    }

    // Apply filters
    if (contract_type) {
      dbQuery = dbQuery.eq("contract_type", contract_type);
    }
    dbQuery = dbQuery.eq("is_active", is_active);

    // Apply pagination
    dbQuery = dbQuery
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: templates, error, count } = await dbQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: templates,
      count: count ?? 0,
      page,
      limit,
      total_pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contracts/templates
 * Create a new contract template
 * Only super_admin and staff can create templates
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

    // Only allow super_admin and staff to create templates
    if (!["super_admin", "staff"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const result = templateCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const input = result.data;

    // Determine organization_id: null for super_admin (global), user's org for staff
    let templateOrgId: string | null = null;
    if (role === "staff") {
      templateOrgId = organizationId;
    }
    // super_admin can create global templates (organization_id = null)

    // Create the template
    const { data: template, error } = await (supabase as any)
      .from("contract_templates")
      .insert({
        name: input.name,
        description: input.description,
        contract_type: input.contract_type,
        template_content: input.template_content,
        variables: input.variables,
        organization_id: templateOrgId,
        created_by: user.id,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
