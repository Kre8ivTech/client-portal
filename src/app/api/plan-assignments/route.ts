import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  createPlanAssignmentSchema,
  listPlanAssignmentsQuerySchema,
} from "@/lib/validators/plan";
import { writeAuditLog } from "@/lib/audit";

type ProfileRow = { organization_id: string | null; role: string };

/**
 * GET /api/plan-assignments
 * List plan assignments with filtering based on user role:
 * - super_admin/staff: All assignments
 * - partner: Own org + client organizations
 * - client: Own organization only
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    const prof = profile as ProfileRow | null;
    const role = prof?.role ?? "client";
    const organizationId = prof?.organization_id ?? null;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      organization_id: searchParams.get("organization_id") || undefined,
      plan_id: searchParams.get("plan_id") || undefined,
      status: searchParams.get("status") || undefined,
      auto_renew: searchParams.get("auto_renew") === "true" ? true :
                  searchParams.get("auto_renew") === "false" ? false : undefined,
      upcoming_renewal_days: searchParams.get("upcoming_renewal_days")
        ? parseInt(searchParams.get("upcoming_renewal_days")!)
        : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0,
    };

    const result = listPlanAssignmentsQuerySchema.safeParse(queryParams);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const query = result.data;

    // Build the base query with plan details
    let dbQuery = supabase
      .from("plan_assignments")
      .select(`
        id,
        plan_id,
        organization_id,
        partner_client_org_id,
        start_date,
        next_billing_date,
        billing_cycle_day,
        status,
        auto_renew,
        support_hours_used,
        dev_hours_used,
        last_hours_reset_date,
        grace_period_start,
        grace_period_end,
        cancellation_requested_at,
        cancellation_reason,
        cancelled_at,
        proration_credit,
        created_at,
        updated_at,
        plans (
          id,
          name,
          description,
          support_hours_included,
          dev_hours_included,
          support_hourly_rate,
          dev_hourly_rate,
          monthly_fee,
          currency
        ),
        organizations:organization_id (
          id,
          name,
          slug
        )
      `, { count: "exact" });

    // Apply role-based filtering
    if (role === "super_admin" || role === "staff") {
      // Can see all assignments
    } else if (role === "partner" || role === "partner_staff") {
      // Partners can see their own + client assignments
      if (organizationId) {
        // Get child organization IDs
        const { data: childOrgs } = await supabase
          .from("organizations")
          .select("id")
          .eq("parent_org_id", organizationId);

        const childIds = (childOrgs ?? []).map((o: { id: string }) => o.id);
        const allOrgIds = [organizationId, ...childIds];

        dbQuery = dbQuery.in("organization_id", allOrgIds);
      } else {
        return NextResponse.json({ data: [], count: 0 });
      }
    } else {
      // Clients can only see their own assignments
      if (organizationId) {
        dbQuery = dbQuery.eq("organization_id", organizationId);
      } else {
        return NextResponse.json({ data: [], count: 0 });
      }
    }

    // Apply filters
    if (query.organization_id) {
      dbQuery = dbQuery.eq("organization_id", query.organization_id);
    }
    if (query.plan_id) {
      dbQuery = dbQuery.eq("plan_id", query.plan_id);
    }
    if (query.status) {
      dbQuery = dbQuery.eq("status", query.status);
    }
    if (query.auto_renew !== undefined) {
      dbQuery = dbQuery.eq("auto_renew", query.auto_renew);
    }
    if (query.upcoming_renewal_days) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + query.upcoming_renewal_days);
      dbQuery = dbQuery.lte("next_billing_date", futureDate.toISOString().split("T")[0]);
    }

    // Apply pagination
    dbQuery = dbQuery
      .order("created_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    const { data: assignments, error, count } = await dbQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: assignments,
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
 * POST /api/plan-assignments
 * Create a new plan assignment (assign plan to organization)
 * Only super_admin and staff can create assignments
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    const prof = profile as ProfileRow | null;
    const role = prof?.role ?? "client";

    // Only super_admin and staff can create plan assignments
    if (!["super_admin", "staff"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const result = createPlanAssignmentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const input = result.data;

    // Verify the plan exists and is active
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, name, is_active")
      .eq("id", input.plan_id)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    if (!plan.is_active) {
      return NextResponse.json(
        { error: "Cannot assign an inactive plan" },
        { status: 400 }
      );
    }

    // Verify the organization exists
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", input.organization_id)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check for existing active assignment
    const { data: existingAssignment } = await supabase
      .from("plan_assignments")
      .select("id")
      .eq("organization_id", input.organization_id)
      .in("status", ["pending", "active", "grace_period"])
      .is("partner_client_org_id", null)
      .single();

    if (existingAssignment) {
      return NextResponse.json(
        { error: "Organization already has an active plan assignment" },
        { status: 409 }
      );
    }

    // Calculate next billing date
    const startDate = new Date(input.start_date);
    const nextBillingDate = new Date(startDate);
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    nextBillingDate.setDate(input.billing_cycle_day);

    // Create the assignment
    const { data: assignment, error } = await supabase
      .from("plan_assignments")
      .insert({
        plan_id: input.plan_id,
        organization_id: input.organization_id,
        partner_client_org_id: input.partner_client_org_id || null,
        start_date: input.start_date,
        next_billing_date: nextBillingDate.toISOString().split("T")[0],
        billing_cycle_day: input.billing_cycle_day,
        auto_renew: input.auto_renew ?? true,
        status: "active",
        support_hours_used: 0,
        dev_hours_used: 0,
        last_hours_reset_date: input.start_date,
      })
      .select(`
        *,
        plans (
          id,
          name,
          support_hours_included,
          dev_hours_included,
          monthly_fee
        )
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Write audit log
    await writeAuditLog({
      action: "plan_assignment.create",
      entity_type: "plan_assignment",
      entity_id: assignment.id,
      new_values: {
        plan_id: input.plan_id,
        organization_id: input.organization_id,
        start_date: input.start_date,
      },
      details: {
        plan_name: plan.name,
        organization_name: org.name,
      },
    });

    return NextResponse.json({ data: assignment }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
