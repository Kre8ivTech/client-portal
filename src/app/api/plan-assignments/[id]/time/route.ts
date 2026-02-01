import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";

type ProfileRow = { organization_id: string | null; role: string };
type AssignmentRow = {
  id: string;
  organization_id: string;
  status: string;
  support_hours_used: number | null;
  dev_hours_used: number | null;
  plans: {
    id: string;
    name: string;
    support_hours_included: number;
    dev_hours_included: number;
    support_hourly_rate: number;
    dev_hourly_rate: number;
  } | null;
};

// Schema for logging time against a plan assignment
const logTimeSchema = z.object({
  description: z.string().min(1).max(2000),
  hours: z.number().positive().max(24),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  work_type: z.enum(["support", "dev"]).default("support"),
  ticket_id: z.string().uuid().optional(),
  billable: z.boolean().default(true),
});

export type LogTimeInput = z.infer<typeof logTimeSchema>;

/**
 * POST /api/plan-assignments/[id]/time
 * Log time against a specific plan assignment
 * Only staff and super_admin can log time
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planAssignmentId } = await params;
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

    // Only staff and super_admin can log time
    if (role !== "staff" && role !== "super_admin") {
      return NextResponse.json(
        { error: "Only staff can log time" },
        { status: 403 }
      );
    }

    // Verify the plan assignment exists and is active
    const { data: assignment, error: assignmentError } = await supabase
      .from("plan_assignments")
      .select(`
        id,
        organization_id,
        status,
        support_hours_used,
        dev_hours_used,
        plans (
          id,
          name,
          support_hours_included,
          dev_hours_included,
          support_hourly_rate,
          dev_hourly_rate
        )
      `)
      .eq("id", planAssignmentId)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: "Plan assignment not found" },
        { status: 404 }
      );
    }

    if (assignment.status !== "active" && assignment.status !== "grace_period") {
      return NextResponse.json(
        { error: "Cannot log time to an inactive plan assignment" },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const result = logTimeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const input = result.data;
    const entryDate = input.entry_date || new Date().toISOString().split("T")[0];

    // Calculate if this will cause overage
    const plan = assignment.plans as any;
    const currentUsed = input.work_type === "support"
      ? assignment.support_hours_used ?? 0
      : assignment.dev_hours_used ?? 0;
    const included = input.work_type === "support"
      ? plan?.support_hours_included ?? 0
      : plan?.dev_hours_included ?? 0;

    const willExceed = currentUsed + input.hours > included;
    const overageHours = willExceed
      ? currentUsed + input.hours - included
      : 0;

    // Create the time entry
    const { data: timeEntry, error } = await (supabase as any)
      .from("time_entries")
      .insert({
        organization_id: assignment.organization_id,
        user_id: user.id,
        plan_assignment_id: planAssignmentId,
        ticket_id: input.ticket_id || null,
        description: input.description,
        hours: input.hours,
        entry_date: entryDate,
        work_type: input.work_type,
        billable: input.billable,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch updated assignment hours (trigger should have updated them)
    const { data: updatedAssignment } = await supabase
      .from("plan_assignments")
      .select("support_hours_used, dev_hours_used")
      .eq("id", planAssignmentId)
      .single();

    await writeAuditLog({
      action: "time_entry.create",
      entity_type: "time_entry",
      entity_id: timeEntry.id,
      new_values: {
        plan_assignment_id: planAssignmentId,
        hours: input.hours,
        work_type: input.work_type,
        billable: input.billable,
      },
      details: {
        description: input.description,
        ticket_id: input.ticket_id,
        will_exceed_limit: willExceed,
        overage_hours: overageHours,
      },
    });

    // Calculate remaining hours
    const supportRemaining = Math.max(
      0,
      (plan?.support_hours_included ?? 0) - (updatedAssignment?.support_hours_used ?? 0)
    );
    const devRemaining = Math.max(
      0,
      (plan?.dev_hours_included ?? 0) - (updatedAssignment?.dev_hours_used ?? 0)
    );

    return NextResponse.json({
      data: {
        time_entry: timeEntry,
        hours_summary: {
          support_hours_used: updatedAssignment?.support_hours_used ?? 0,
          dev_hours_used: updatedAssignment?.dev_hours_used ?? 0,
          support_hours_remaining: supportRemaining,
          dev_hours_remaining: devRemaining,
          will_exceed_limit: willExceed,
          overage_hours: overageHours,
        },
      },
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/plan-assignments/[id]/time
 * Get all time entries for a plan assignment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planAssignmentId } = await params;
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

    // Fetch the assignment to verify access
    const { data: assignment, error: assignmentError } = await supabase
      .from("plan_assignments")
      .select("id, organization_id")
      .eq("id", planAssignmentId)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: "Plan assignment not found" },
        { status: 404 }
      );
    }

    // Check access
    const isAdmin = role === "super_admin" || role === "staff";
    const isOwner = assignment.organization_id === organizationId;

    if (!isAdmin && !isOwner) {
      // Check if partner has access
      if (organizationId) {
        const { data: clientOrg } = await supabase
          .from("organizations")
          .select("parent_org_id")
          .eq("id", assignment.organization_id)
          .single();

        if (clientOrg?.parent_org_id !== organizationId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const workType = searchParams.get("work_type") as "support" | "dev" | null;
    const billable = searchParams.get("billable");
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("time_entries")
      .select(`
        id,
        description,
        hours,
        entry_date,
        billable,
        work_type,
        ticket_id,
        created_at,
        user_id,
        users:user_id (
          id,
          email
        ),
        tickets:ticket_id (
          id,
          ticket_number,
          subject
        )
      `, { count: "exact" })
      .eq("plan_assignment_id", planAssignmentId);

    if (workType) {
      query = query.eq("work_type", workType);
    }
    if (billable !== null) {
      query = query.eq("billable", billable === "true");
    }
    if (fromDate) {
      query = query.gte("entry_date", fromDate);
    }
    if (toDate) {
      query = query.lte("entry_date", toDate);
    }

    query = query
      .order("entry_date", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: timeEntries, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get aggregates
    const { data: aggregates } = await supabase
      .rpc("calculate_plan_hours_used", { p_plan_assignment_id: planAssignmentId });

    return NextResponse.json({
      data: timeEntries,
      count: count ?? 0,
      limit,
      offset,
      aggregates: {
        total_hours: aggregates ?? 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
