"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import { materializeDueSchedules } from "@/lib/ai/run-workflow-schedules";
import { nextRunAt, SCHEDULE_FREQUENCIES, SCHEDULE_TIME_ZONES } from "@/lib/ai/workflow-schedule";

const PATH = "/dashboard/admin/agents";

const stepSchema = z.object({
  agentId: z.string().uuid(),
  instruction: z.string().trim().min(3, "Each step needs an instruction").max(2000),
});

const workflowSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  description: z.string().trim().max(2000).optional().default(""),
  status: z.enum(["draft", "active", "paused"]),
  steps: z.array(stepSchema).min(1, "Add at least one step").max(20),
});

const assignmentSchema = z.object({
  title: z.string().trim().min(2).max(200),
  workflowId: z.string().uuid(),
  stepId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid(),
  dueAt: z.string().datetime().nullable().optional(),
  details: z.string().trim().max(2000).optional().default(""),
});

const scheduleSchema = z
  .object({
    workflowId: z.string().uuid(),
    assigneeId: z.string().uuid(),
    frequency: z.enum(SCHEDULE_FREQUENCIES),
    weekday: z.number().int().min(0).max(6).nullable(),
    timeOfDay: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
    timeZone: z.enum(SCHEDULE_TIME_ZONES),
    isActive: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.frequency === "weekly" && value.weekday == null) {
      ctx.addIssue({ code: "custom", message: "Choose a weekday", path: ["weekday"] });
    }
  });

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
});

function failure(error: z.ZodError | { message: string }) {
  if ("issues" in error) {
    return { success: false as const, error: error.issues[0]?.message || "Check the form and try again" };
  }
  return { success: false as const, error: error.message };
}

async function assertAssignee(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, assigneeId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("id, role, status")
    .eq("id", assigneeId)
    .maybeSingle();
  if (error) return failure(error);
  const person = data as { role?: string; status?: string } | null;
  if (!person || !["super_admin", "staff"].includes(person.role || "") || person.status === "inactive") {
    return failure({ message: "Assign this to an active staff member or super admin" });
  }
  return null;
}

export async function saveAgentWorkflow(input: z.input<typeof workflowSchema>) {
  const { user } = await requireRole(["super_admin", "staff"]);
  const parsed = workflowSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error);

  const supabase = await createServerSupabaseClient();
  const payload = {
    name: parsed.data.name,
    description: parsed.data.description,
    status: parsed.data.status,
    created_by: user.id,
  };

  let workflowId = parsed.data.id;
  if (workflowId) {
    const { error } = await supabase
      .from("ai_workflows")
      .update({ name: payload.name, description: payload.description, status: payload.status })
      .eq("id", workflowId);
    if (error) return failure(error);
    const { error: deleteError } = await supabase.from("ai_workflow_steps").delete().eq("workflow_id", workflowId);
    if (deleteError) return failure(deleteError);
  } else {
    const { data, error } = await supabase.from("ai_workflows").insert(payload).select("id").single();
    if (error) return failure(error);
    workflowId = (data as { id: string }).id;
  }

  const { error: stepError } = await supabase.from("ai_workflow_steps").insert(
    parsed.data.steps.map((step, index) => ({
      workflow_id: workflowId,
      agent_id: step.agentId,
      position: index + 1,
      instruction: step.instruction,
    })),
  );
  if (stepError) return failure(stepError);

  revalidatePath(PATH);
  return { success: true as const, id: workflowId };
}

export async function deleteAgentWorkflow(id: string) {
  await requireRole(["super_admin", "staff"]);
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return failure({ message: "Unknown workflow" });
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("ai_workflows").delete().eq("id", parsed.data);
  if (error) return failure(error);
  revalidatePath(PATH);
  return { success: true as const };
}

export async function assignAgentTask(input: z.input<typeof assignmentSchema>) {
  const { user } = await requireRole(["super_admin", "staff"]);
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error);
  const supabase = await createServerSupabaseClient();
  const assigneeError = await assertAssignee(supabase, parsed.data.assigneeId);
  if (assigneeError) return assigneeError;

  const { error } = await supabase.from("ai_task_assignments").insert({
    workflow_id: parsed.data.workflowId,
    step_id: parsed.data.stepId ?? null,
    title: parsed.data.title,
    details: parsed.data.details,
    assignee_id: parsed.data.assigneeId,
    due_at: parsed.data.dueAt ?? null,
    status: "open",
    created_by: user.id,
  });
  if (error) return failure(error);
  revalidatePath(PATH);
  return { success: true as const };
}

export async function updateAgentTaskStatus(input: z.input<typeof statusSchema>) {
  await requireRole(["super_admin", "staff"]);
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("ai_task_assignments").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) return failure(error);
  revalidatePath(PATH);
  return { success: true as const };
}

export async function saveAgentSchedule(input: z.input<typeof scheduleSchema>) {
  const { user } = await requireRole(["super_admin", "staff"]);
  const parsed = scheduleSchema.safeParse({
    ...input,
    weekday: input.frequency === "weekly" ? input.weekday : null,
  });
  if (!parsed.success) return failure(parsed.error);
  const supabase = await createServerSupabaseClient();
  const assigneeError = await assertAssignee(supabase, parsed.data.assigneeId);
  if (assigneeError) return assigneeError;

  const next = nextRunAt({
    frequency: parsed.data.frequency,
    weekday: parsed.data.weekday,
    timeOfDay: parsed.data.timeOfDay,
    timeZone: parsed.data.timeZone,
    from: new Date(),
  });

  const { error } = await supabase.from("ai_workflow_schedules").insert({
    workflow_id: parsed.data.workflowId,
    assignee_id: parsed.data.assigneeId,
    frequency: parsed.data.frequency,
    weekday: parsed.data.weekday,
    time_of_day: parsed.data.timeOfDay,
    timezone: parsed.data.timeZone,
    is_active: parsed.data.isActive,
    next_run_at: next.toISOString(),
    created_by: user.id,
  });
  if (error) return failure(error);
  revalidatePath(PATH);
  return { success: true as const, nextRunAt: next.toISOString() };
}

export async function setAgentScheduleActive(id: string, isActive: boolean) {
  await requireRole(["super_admin", "staff"]);
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return failure({ message: "Unknown schedule" });
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("ai_workflow_schedules").update({ is_active: isActive }).eq("id", parsed.data);
  if (error) return failure(error);
  revalidatePath(PATH);
  return { success: true as const };
}

export async function runAgentScheduleNow(id: string) {
  await requireRole(["super_admin", "staff"]);
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return failure({ message: "Unknown schedule" });
  const supabase = await createServerSupabaseClient();
  const result = await materializeDueSchedules(supabase, new Date(), { scheduleId: parsed.data, force: true });
  if (result.error) return failure({ message: result.error });
  revalidatePath(PATH);
  return { success: true as const, created: result.created };
}
