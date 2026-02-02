"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";

export async function createTimeEntry(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data: profileData } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  type ProfileRow = { organization_id: string | null; role?: string };
  const profile = profileData as ProfileRow | null;

  if (!profile?.organization_id)
    throw new Error("No organization found for user");

  const role = profile.role;
  if (role !== "staff" && role !== "super_admin")
    throw new Error("Only staff and admin can log time");

  const description = formData.get("description") as string;
  const hoursStr = formData.get("hours") as string;
  const entryDate = formData.get("entry_date") as string;
  const ticketId = (formData.get("ticket_id") as string) || null;
  const planAssignmentId = (formData.get("plan_assignment_id") as string) || null;
  const workType = (formData.get("work_type") as string) || "support";
  const billable = formData.get("billable") === "true" || formData.get("billable") === "on";

  const hours = parseFloat(hoursStr);
  if (isNaN(hours) || hours <= 0 || hours > 24)
    throw new Error("Hours must be between 0 and 24");

  // Validate work_type
  if (workType !== "support" && workType !== "dev") {
    throw new Error("Work type must be 'support' or 'dev'");
  }

  // If plan_assignment_id is provided, verify it exists and belongs to the org
  if (planAssignmentId) {
    const { data: assignment, error: assignmentError } = await (supabase as any)
      .from("plan_assignments")
      .select("id, organization_id, status")
      .eq("id", planAssignmentId)
      .single();

    if (assignmentError || !assignment) {
      throw new Error("Plan assignment not found");
    }

    const assignmentStatus = (assignment as { status: string }).status;
    if (assignmentStatus !== "active" && assignmentStatus !== "grace_period") {
      throw new Error("Cannot log time to an inactive plan assignment");
    }
  }

  const { data: timeEntry, error } = await (supabase as any).from("time_entries").insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    ticket_id: ticketId || null,
    plan_assignment_id: planAssignmentId || null,
    work_type: workType,
    description,
    hours,
    entry_date: entryDate || new Date().toISOString().slice(0, 10),
    billable,
  }).select().single();

  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: "time_entry.create",
    entity_type: "time_entry",
    entity_id: timeEntry?.id,
    details: {
      description,
      hours,
      ticket_id: ticketId,
      plan_assignment_id: planAssignmentId,
      work_type: workType,
      billable,
    },
  });

  revalidatePath("/dashboard/time");
  revalidatePath("/dashboard/billing");
  return { success: true, data: timeEntry };
}

export async function deleteTimeEntry(id: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: "time_entry.delete",
    entity_type: "time_entry",
    entity_id: id,
  });

  revalidatePath("/dashboard/time");
  return { success: true };
}
