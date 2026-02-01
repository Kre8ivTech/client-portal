import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { updatePlanAssignmentSchema, requestCancellationSchema } from "@/lib/validators/plan";
import { writeAuditLog } from "@/lib/audit";

type ProfileRow = { organization_id: string | null; role: string };
type AssignmentRow = {
  id: string;
  organization_id: string;
  status: string;
  support_hours_used: number | null;
  dev_hours_used: number | null;
  auto_renew: boolean | null;
  cancellation_requested_at: string | null;
  plans: { support_hours_included: number; dev_hours_included: number } | null;
  [key: string]: unknown;
};

/**
 * GET /api/plan-assignments/[id]
 * Get a single plan assignment with full details and time entry history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Fetch the assignment with related data
    const { data: assignment, error } = await supabase
      .from("plan_assignments")
      .select(`
        *,
        plans (
          id,
          name,
          description,
          support_hours_included,
          dev_hours_included,
          support_hourly_rate,
          dev_hourly_rate,
          monthly_fee,
          currency,
          payment_terms_days,
          rush_support_included,
          rush_support_fee
        ),
        organizations:organization_id (
          id,
          name,
          slug,
          type
        )
      `)
      .eq("id", id)
      .single();

    if (error || !assignment) {
      return NextResponse.json(
        { error: "Plan assignment not found" },
        { status: 404 }
      );
    }

    // Check access permissions
    const canAccess =
      role === "super_admin" ||
      role === "staff" ||
      assignment.organization_id === organizationId;

    // Also check if user is a partner with access to this client org
    if (!canAccess && organizationId) {
      const { data: clientOrg } = await supabase
        .from("organizations")
        .select("parent_org_id")
        .eq("id", assignment.organization_id)
        .single();

      if (clientOrg?.parent_org_id !== organizationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Get recent time entries for this assignment
    const { data: timeEntries } = await supabase
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
        )
      `)
      .eq("plan_assignment_id", id)
      .order("entry_date", { ascending: false })
      .limit(50);

    // Get current period hour logs
    const { data: hourLogs } = await supabase
      .from("plan_hour_logs")
      .select("*")
      .eq("plan_assignment_id", id)
      .order("period_start", { ascending: false })
      .limit(12);

    // Calculate hours remaining
    const plan = assignment.plans as any;
    const supportHoursRemaining = Math.max(
      0,
      (plan?.support_hours_included ?? 0) - (assignment.support_hours_used ?? 0)
    );
    const devHoursRemaining = Math.max(
      0,
      (plan?.dev_hours_included ?? 0) - (assignment.dev_hours_used ?? 0)
    );

    return NextResponse.json({
      data: {
        ...assignment,
        support_hours_remaining: supportHoursRemaining,
        dev_hours_remaining: devHoursRemaining,
        time_entries: timeEntries ?? [],
        hour_logs: hourLogs ?? [],
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
 * PATCH /api/plan-assignments/[id]
 * Update a plan assignment (pause, resume, change auto_renew, request cancellation)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Fetch existing assignment
    const { data: existingAssignment, error: fetchError } = await supabase
      .from("plan_assignments")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingAssignment) {
      return NextResponse.json(
        { error: "Plan assignment not found" },
        { status: 404 }
      );
    }

    // Check permissions
    const isAdmin = role === "super_admin" || role === "staff";
    const isOwner = existingAssignment.organization_id === organizationId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Determine update type: admin update vs client cancellation request
    if (body.cancellation_reason !== undefined || body.request_cancellation) {
      // Client requesting cancellation
      const result = requestCancellationSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json(
          { error: "Validation failed", details: result.error.flatten() },
          { status: 400 }
        );
      }

      const { data: updated, error } = await supabase
        .from("plan_assignments")
        .update({
          cancellation_requested_at: new Date().toISOString(),
          cancellation_requested_by: user.id,
          cancellation_reason: result.data.cancellation_reason || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await writeAuditLog({
        action: "plan_assignment.cancellation_requested",
        entity_type: "plan_assignment",
        entity_id: id,
        old_values: {
          cancellation_requested_at: existingAssignment.cancellation_requested_at,
        },
        new_values: {
          cancellation_requested_at: updated.cancellation_requested_at,
          cancellation_reason: result.data.cancellation_reason,
        },
      });

      return NextResponse.json({ data: updated });
    }

    // Admin status updates
    if (!isAdmin) {
      // Non-admins can only toggle auto_renew
      const allowedFields = ["auto_renew"];
      const requestedFields = Object.keys(body);
      const disallowedFields = requestedFields.filter(
        (f) => !allowedFields.includes(f)
      );

      if (disallowedFields.length > 0) {
        return NextResponse.json(
          { error: `Cannot update fields: ${disallowedFields.join(", ")}` },
          { status: 403 }
        );
      }
    }

    // Validate admin update
    const result = updatePlanAssignmentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (result.data.auto_renew !== undefined) {
      updateData.auto_renew = result.data.auto_renew;
    }

    if (isAdmin && result.data.status !== undefined) {
      updateData.status = result.data.status;

      // If cancelling, set cancelled_at and cancelled_by
      if (result.data.status === "cancelled") {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancelled_by = user.id;
      }

      // If pausing
      if (result.data.status === "paused") {
        // Store current state for potential resume
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from("plan_assignments")
      .update(updateData)
      .eq("id", id)
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

    await writeAuditLog({
      action: "plan_assignment.update",
      entity_type: "plan_assignment",
      entity_id: id,
      old_values: {
        status: existingAssignment.status,
        auto_renew: existingAssignment.auto_renew,
      },
      new_values: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/plan-assignments/[id]
 * Cancel a plan assignment (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const role = (profile as ProfileRow | null)?.role ?? "client";

    // Only admins can delete/cancel assignments
    if (role !== "super_admin" && role !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch the assignment first
    const { data: assignment, error: fetchError } = await supabase
      .from("plan_assignments")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !assignment) {
      return NextResponse.json(
        { error: "Plan assignment not found" },
        { status: 404 }
      );
    }

    // Instead of deleting, we cancel the assignment
    const { data: cancelled, error } = await supabase
      .from("plan_assignments")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeAuditLog({
      action: "plan_assignment.cancel",
      entity_type: "plan_assignment",
      entity_id: id,
      old_values: { status: assignment.status },
      new_values: { status: "cancelled" },
    });

    return NextResponse.json({ data: cancelled });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
